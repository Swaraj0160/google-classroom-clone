import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

/**
 * Extracts a safe-to-log summary from a googleapis error — HTTP status
 * code, top-level message, and the API's structured reason (e.g.
 * "notFound", "insufficientPermissions", "invalid_grant"). Never touches
 * request/auth headers, so this can never leak the refresh token or
 * client secret even though the raw error object technically has them
 * attached to internal request config.
 */
export function sanitizeDriveError(err: unknown): {
  code?: number | string;
  message?: string;
  reason?: string;
} {
  if (err instanceof DriveAuthRequiredError) {
    return { code: "AUTH_REQUIRED", message: "Google Drive authentication is required.", reason: "invalid_grant" };
  }

  const e = err as {
    code?: number | string;
    message?: string;
    errors?: { reason?: string; message?: string }[];
    response?: {
      status?: number;
      data?: {
        error?: string | { message?: string; status?: string };
        error_description?: string;
      };
    };
  };
  const responseData = e?.response?.data;
  // Two different shapes come out of googleapis: Drive API errors nest under
  // response.data.error.{message,status}; OAuth token-refresh errors (e.g.
  // invalid_grant) put a flat string in response.data.error plus
  // response.data.error_description — handle both without ever touching
  // request/auth headers (so this can never leak the refresh token/secret).
  const nestedError = typeof responseData?.error === "object" ? responseData.error : undefined;
  const flatError = typeof responseData?.error === "string" ? responseData.error : undefined;

  return {
    code: e?.code ?? e?.response?.status,
    message: nestedError?.message ?? responseData?.error_description ?? e?.message,
    reason: e?.errors?.[0]?.reason ?? nestedError?.status ?? flatError,
  };
}

export type DriveErrorCategory =
  | "DRIVE_FILE_NOT_FOUND"
  | "DRIVE_PERMISSION_DENIED"
  | "DRIVE_AUTH_FAILED"
  | "DRIVE_STORAGE_QUOTA_EXCEEDED"
  | "DRIVE_RATE_LIMITED"
  | "DRIVE_NETWORK_ERROR"
  | "DRIVE_DOWNLOAD_FAILED"; // fallback / "unknown storage error"

// Node-level network failure codes (DNS/connection-level, not an HTTP
// response from Google at all) — distinct from a real Drive API error.
const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/**
 * Buckets a Drive/OAuth error into one of the categories callers (view,
 * upload-session, upload-finalize routes, health check) use to pick a
 * response that doesn't lie to the user — an expired/revoked refresh token
 * must never be reported as "file not found" or "storage full", and a real
 * storage-quota error must never be collapsed into the same generic
 * "permission denied" bucket as an ordinary 403, since the fix is
 * completely different. Checked in order of specificity: Google returns
 * 403 for several unrelated reasons (quota, rate limiting, plain
 * permission denial) that all share the same HTTP status code and are
 * only distinguishable via the structured `reason` field.
 */
export function classifyDriveError(err: unknown): DriveErrorCategory {
  if (err instanceof DriveAuthRequiredError) return "DRIVE_AUTH_FAILED";

  const info = sanitizeDriveError(err);
  if (info.reason === "invalid_grant" || info.code === 401) return "DRIVE_AUTH_FAILED";
  if (info.reason === "storageQuotaExceeded") return "DRIVE_STORAGE_QUOTA_EXCEEDED";
  if (
    info.reason === "rateLimitExceeded" ||
    info.reason === "userRateLimitExceeded" ||
    info.reason === "dailyLimitExceeded" ||
    info.code === 429
  ) {
    return "DRIVE_RATE_LIMITED";
  }
  if (typeof info.code === "string" && NETWORK_ERROR_CODES.has(info.code)) return "DRIVE_NETWORK_ERROR";
  if (info.code === 404) return "DRIVE_FILE_NOT_FOUND";
  if (info.code === 403) return "DRIVE_PERMISSION_DENIED";
  return "DRIVE_DOWNLOAD_FAILED";
}

/**
 * Thrown instead of ever attempting a Drive call while the circuit breaker
 * below is open (see withDriveAuth). Carries no network round trip, so a
 * known-dead refresh token fails every request instantly instead of each
 * one separately re-exchanging it with Google and waiting on that to fail.
 */
export class DriveAuthRequiredError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super("Google Drive authentication is required.");
    this.name = "DriveAuthRequiredError";
    this.reason = reason;
  }
}

/**
 * Regular Google accounts have no service-account storage quota, so Drive
 * access uses OAuth2 (authorization-code + refresh token) acting as the
 * actual account that owns "Faculty Classroom Storage". See
 * app/api/auth/google for the one-time authorization flow that issues the
 * refresh token.
 *
 * This module is the ONLY place in the running application that
 * constructs a Drive OAuth client — every exported function below routes
 * through withDriveAuth(), which is the single source of truth for both
 * the cached client and the auth-failure circuit breaker. Nothing else in
 * the app (routes, hooks, components) is allowed to build its own client;
 * grep for "google.auth.OAuth2" or "new google.auth" outside this file
 * should only ever match the one-time setup routes under
 * app/api/auth/google (which mint a refresh token, not use one) and the
 * standalone diagnostic/migration scripts under scripts/ (separate,
 * short-lived Node processes, not part of the running app).
 *
 * Client caching: one OAuth2Client instance is reused per warm process
 * instead of building a fresh one per call. google-auth-library's
 * OAuth2Client already caches the short-lived access token it gets back
 * and only re-hits Google's token endpoint once that access token
 * actually expires (~1 hour) — but only if the SAME client instance is
 * reused. Building a new client (and therefore forcing a brand-new
 * refresh-token exchange) on every single Drive call was directly
 * observed during diagnosis to correlate with the token later failing
 * with invalid_grant — see the circuit breaker below for the other half
 * of the fix.
 *
 * Circuit breaker: an invalid_grant is not a transient failure — the
 * refresh token is genuinely revoked/expired and cannot be repaired by
 * retrying, only by a human completing the OAuth consent flow again and
 * this app being redeployed with the new token. Once a real invalid_grant
 * is observed, this module stops attempting further Drive calls for
 * DRIVE_AUTH_RECHECK_INTERVAL_MS and fails them immediately and locally
 * instead — this both gives callers a fast, honest DRIVE_AUTH_FAILED
 * instead of hanging on a doomed network round trip, and stops this
 * server from repeatedly re-submitting a known-dead refresh token to
 * Google, which is itself the kind of repeated-failure pattern that can
 * make Google's abuse heuristics view the credential as compromised.
 */
let cachedOAuth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;

interface DriveAuthCircuit {
  open: boolean;
  openedAt: number | null;
  reason: string | null;
}
let driveAuthCircuit: DriveAuthCircuit = { open: false, openedAt: null, reason: null };
const DRIVE_AUTH_RECHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function isCircuitOpen(): boolean {
  if (!driveAuthCircuit.open) return false;
  if (driveAuthCircuit.openedAt === null) return true;
  return Date.now() - driveAuthCircuit.openedAt < DRIVE_AUTH_RECHECK_INTERVAL_MS;
}

function tripCircuit(reason: string) {
  const wasOpen = driveAuthCircuit.open;
  driveAuthCircuit = { open: true, openedAt: Date.now(), reason };
  if (!wasOpen) {
    // Names/reasons only — never credentials — so this is safe to log.
    console.error("[DRIVE_AUTH_REQUIRED]", JSON.stringify({ reason, action: "reconnect_required" }));
  }
}

/**
 * Drops the cached client and closes the circuit breaker — call this after
 * an administrator reconnects Drive (new refresh token deployed) so the
 * next call builds a fresh client instead of waiting out the recheck
 * interval or requiring a full redeploy. Not used by any request path
 * itself; wired to the admin "Reconnect Google Drive" flow.
 */
export function resetDriveAuthCache(): void {
  cachedOAuth2Client = null;
  driveAuthCircuit = { open: false, openedAt: null, reason: null };
}

function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!refreshToken) missing.push("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (missing.length) {
    // Names only — never values — so this is safe to log server-side.
    console.error("[googleDrive] stage=not_configured missing:", missing.join(", "));
    throw new Error("Google Drive is not configured on the server.");
  }

  if (cachedOAuth2Client) return cachedOAuth2Client;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  cachedOAuth2Client = oauth2Client;
  return oauth2Client;
}

function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getAuth() });
}

/**
 * The single entry point every Drive operation in this module goes
 * through. Short-circuits instantly (no network call) while the breaker
 * is open; otherwise runs the operation and trips the breaker if it turns
 * out to be a genuine invalid_grant.
 */
async function withDriveAuth<T>(operation: (drive: drive_v3.Drive) => Promise<T>): Promise<T> {
  if (isCircuitOpen()) {
    throw new DriveAuthRequiredError(driveAuthCircuit.reason ?? "invalid_grant");
  }
  const drive = getDriveClient();
  try {
    return await operation(drive);
  } catch (err) {
    const info = sanitizeDriveError(err);
    if (info.reason === "invalid_grant") {
      tripCircuit(info.message ?? "invalid_grant");
    }
    throw err;
  }
}

function rootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) {
    console.error("[googleDrive] stage=not_configured missing: GOOGLE_DRIVE_ROOT_FOLDER_ID");
    throw new Error("Google Drive is not configured on the server.");
  }
  return id;
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapeQueryValue(
      name
    )}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("Failed to create Drive folder.");
  return res.data.id;
}

async function getOrCreateFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const existing = await findChildFolder(drive, parentId, name);
  if (existing) return existing;
  return createChildFolder(drive, parentId, name);
}

const FOLDER_NAME_MAX_LENGTH = 120;

/**
 * Makes a DB-derived label (course title, assignment title, student name...)
 * safe as a single Drive folder-name segment. Purely cosmetic/for human
 * browsing — never used to derive or look up the actual file reference,
 * which is always the Drive file id stored in the DB. Deliberately avoids
 * regex character classes here; kept as plain split/join string ops.
 */
export function sanitizeFolderName(label: string): string {
  const withoutSlashes = label.split("/").join("-").split("\\").join("-");
  const collapsedWhitespace = withoutSlashes.split(/\s+/).join(" ").trim();
  const truncated =
    collapsedWhitespace.length > FOLDER_NAME_MAX_LENGTH
      ? collapsedWhitespace.slice(0, FOLDER_NAME_MAX_LENGTH).trim()
      : collapsedWhitespace;
  return truncated || "untitled";
}

/** Walks/creates a nested folder path under the app's root Drive folder. */
export async function resolveFolderPath(segments: string[]): Promise<string> {
  return withDriveAuth(async (drive) => {
    const rootId = rootFolderId();

    try {
      await drive.files.get({ fileId: rootId, fields: "id", supportsAllDrives: true });
    } catch (err) {
      const info = sanitizeDriveError(err);
      if (info.code === 404) {
        console.error(
          "[googleDrive] stage=root_folder_get_failed reason=not_visible",
          info,
          "— either re-run /api/auth/google signed into the account that owns the folder,",
          "or share the folder (Editor) with the account that was used to authorize."
        );
      } else {
        console.error("[googleDrive] stage=root_folder_get_failed", info);
      }
      throw err;
    }

    let parentId = rootId;
    try {
      for (const segment of segments) {
        if (!segment) continue;
        parentId = await getOrCreateFolder(drive, parentId, segment);
      }
    } catch (err) {
      console.error("[googleDrive] stage=folder_resolve_failed", { segments }, sanitizeDriveError(err));
      throw err;
    }
    return parentId;
  });
}

export interface DriveFileResult {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<DriveFileResult> {
  return withDriveAuth(async (drive) => {
    let res;
    try {
      res = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
        fields: "id, name, mimeType, size",
        supportsAllDrives: true,
      });
    } catch (err) {
      console.error(
        "[DRIVE_UPLOAD]",
        JSON.stringify({ folderId, fileName, size: buffer.byteLength, status: "failed" }),
        sanitizeDriveError(err)
      );
      throw err;
    }
    if (!res.data.id) {
      console.error("[DRIVE_UPLOAD]", JSON.stringify({ folderId, fileName, status: "no_file_id" }));
      throw new Error("Google Drive upload failed.");
    }
    console.log("[DRIVE_UPLOAD]", JSON.stringify({ folderId, fileName, driveFileId: res.data.id, status: "success" }));
    return {
      id: res.data.id,
      name: res.data.name ?? fileName,
      mimeType: res.data.mimeType ?? mimeType,
      size: Number(res.data.size ?? buffer.byteLength),
    };
  });
}

/**
 * Starts a Google Drive resumable-upload session and returns the session
 * URL Google issues — the browser then PUTs the file's bytes directly to
 * that URL, never through this server.
 *
 * WHY: Vercel Serverless Functions enforce a hard ~4.5MB request body
 * limit at the platform level, before a route handler even runs — proven
 * in production (a 6MB request to the old single-request upload route
 * came back `413 FUNCTION_PAYLOAD_TOO_LARGE` from Vercel itself, with the
 * actual cutoff between 4MB and 4.4MB). uploadFile() above (buffer through
 * this server) is therefore only safe for uploads comfortably under that
 * ceiling; anything the app's own advertised limits allow (documents up
 * to 10MB, archives/video up to 25MB, submissions totaling up to 30MB)
 * would routinely fail that way — a raw platform error with no useful
 * message, unrelated to Drive/DB health.
 *
 * SECURITY: this never hands the browser any standing credential. The
 * session URL is single-use, tied to the exact `name`/`parents` decided
 * here from server-validated folder/authorization logic (a client cannot
 * redirect the upload to a different folder), and Drive enforces the
 * `X-Upload-Content-Length` declared here as a hard cap on how many bytes
 * the session will accept — so the byte-count limit this app already
 * validates before calling this function is enforced by Google itself,
 * not by anything watching the bytes in transit. The resulting file id is
 * never trusted on its own afterward — see getFileMeta()'s use in the
 * finalize step, which independently re-fetches it from Drive before any
 * DB row is created.
 */
export async function createResumableUploadSession(
  folderId: string,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number
): Promise<{ uploadUrl: string }> {
  return withDriveAuth(async () => {
    const auth = getAuth();
    try {
      const res = await auth.request<unknown>({
        url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size&supportsAllDrives=true",
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType || "application/octet-stream",
          "X-Upload-Content-Length": String(fileSizeBytes),
        },
        data: { name: fileName, parents: [folderId] },
      });
      const headers = res.headers as unknown as { get?: (name: string) => string | null } & Record<string, string>;
      const uploadUrl = typeof headers?.get === "function" ? headers.get("location") : headers?.location;
      if (!uploadUrl) {
        console.error("[googleDrive] stage=resumable_session_no_location", { folderId, fileName });
        throw new Error("Google Drive did not return an upload session URL.");
      }
      return { uploadUrl };
    } catch (err) {
      console.error(
        "[googleDrive] stage=create_resumable_session_failed",
        { folderId, fileName, fileSizeBytes },
        sanitizeDriveError(err)
      );
      throw err;
    }
  });
}

export interface DriveFileMeta {
  name: string;
  mimeType: string;
}

export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  return withDriveAuth(async (drive) => {
    try {
      const res = await drive.files.get({
        fileId,
        fields: "name, mimeType",
        supportsAllDrives: true,
      });
      return {
        name: res.data.name ?? "file",
        mimeType: res.data.mimeType ?? "application/octet-stream",
      };
    } catch (err) {
      const category = classifyDriveError(err);
      const tag = category === "DRIVE_FILE_NOT_FOUND" ? "[DRIVE_FILE_NOT_FOUND]" : "[googleDrive]";
      console.error(tag, "stage=get_meta_failed", { fileId }, sanitizeDriveError(err));
      throw err;
    }
  });
}

export async function downloadFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
  return withDriveAuth(async (drive) => {
    try {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream" }
      );
      console.log("[DRIVE_DOWNLOAD]", JSON.stringify({ fileId, status: "success" }));
      return res.data as unknown as NodeJS.ReadableStream;
    } catch (err) {
      console.error("[DRIVE_DOWNLOAD]", JSON.stringify({ fileId, status: "failed" }), sanitizeDriveError(err));
      throw err;
    }
  });
}

export async function deleteFile(fileId: string): Promise<void> {
  return withDriveAuth(async (drive) => {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  });
}

export async function copyFile(
  fileId: string,
  newFolderId: string,
  newName?: string
): Promise<DriveFileResult> {
  return withDriveAuth(async (drive) => {
    const res = await drive.files.copy({
      fileId,
      requestBody: { parents: [newFolderId], ...(newName ? { name: newName } : {}) },
      fields: "id, name, mimeType, size",
      supportsAllDrives: true,
    });
    if (!res.data.id) throw new Error("Google Drive copy failed.");
    return {
      id: res.data.id,
      name: res.data.name ?? newName ?? "file",
      mimeType: res.data.mimeType ?? "application/octet-stream",
      size: Number(res.data.size ?? 0),
    };
  });
}

export interface DriveHealthStatus {
  status:
    | "DRIVE_AUTHENTICATED"
    | "DRIVE_AUTH_REQUIRED"
    | "DRIVE_STORAGE_QUOTA_EXCEEDED"
    | "DRIVE_PERMISSION_DENIED"
    | "DRIVE_RATE_LIMITED"
    | "DRIVE_NETWORK_ERROR"
    | "DRIVE_FILE_NOT_FOUND"
    | "DRIVE_UNKNOWN_ERROR";
  checkedAt: string;
  quota?: { limitBytes: number | null; usageBytes: number; usageInDriveBytes: number };
  message?: string;
}

const CATEGORY_TO_HEALTH_STATUS: Record<DriveErrorCategory, DriveHealthStatus["status"]> = {
  DRIVE_AUTH_FAILED: "DRIVE_AUTH_REQUIRED",
  DRIVE_STORAGE_QUOTA_EXCEEDED: "DRIVE_STORAGE_QUOTA_EXCEEDED",
  DRIVE_PERMISSION_DENIED: "DRIVE_PERMISSION_DENIED",
  DRIVE_RATE_LIMITED: "DRIVE_RATE_LIMITED",
  DRIVE_NETWORK_ERROR: "DRIVE_NETWORK_ERROR",
  DRIVE_FILE_NOT_FOUND: "DRIVE_FILE_NOT_FOUND",
  DRIVE_DOWNLOAD_FAILED: "DRIVE_UNKNOWN_ERROR",
};

/**
 * One minimal, safe-in-production Drive call (`about.get`) that reports
 * both auth health and real storage quota in a single request. Intended
 * for the admin health indicator and manual diagnosis — not called on
 * every page load or from any per-request code path, so it doesn't add to
 * the refresh-token exchange volume this module is otherwise trying to
 * minimize.
 */
export async function checkDriveHealth(): Promise<DriveHealthStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const quota = await withDriveAuth(async (drive) => {
      const res = await drive.about.get({ fields: "storageQuota" });
      return res.data.storageQuota;
    });
    console.log("[DRIVE_QUOTA]", JSON.stringify({ status: "ok" }));
    return {
      status: "DRIVE_AUTHENTICATED",
      checkedAt,
      quota: quota
        ? {
            limitBytes: quota.limit ? Number(quota.limit) : null,
            usageBytes: Number(quota.usage ?? 0),
            usageInDriveBytes: Number(quota.usageInDrive ?? 0),
          }
        : undefined,
    };
  } catch (err) {
    const category = classifyDriveError(err);
    const status = CATEGORY_TO_HEALTH_STATUS[category] ?? "DRIVE_UNKNOWN_ERROR";
    const tag =
      status === "DRIVE_AUTH_REQUIRED"
        ? "[DRIVE_AUTH_REQUIRED]"
        : status === "DRIVE_PERMISSION_DENIED"
          ? "[DRIVE_PERMISSION]"
          : "[DRIVE_QUOTA]";
    console.error(tag, JSON.stringify({ status, checkedAt }));
    return { status, checkedAt, message: sanitizeDriveError(err).message };
  }
}
