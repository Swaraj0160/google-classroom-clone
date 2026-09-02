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
  | "DRIVE_DOWNLOAD_FAILED";

/**
 * Buckets a Drive/OAuth error into one of the categories callers (view and
 * upload routes) use to pick a response that doesn't lie to the user — an
 * expired/revoked refresh token must never be reported as "file not found",
 * and a real storage-quota error must never be collapsed into the same
 * generic "permission denied" bucket as an ordinary 403, since the fix is
 * completely different (contact an admin to free/expand storage, vs. a
 * genuine access-control problem). Checked in order of specificity: Google
 * returns 403 for several unrelated reasons (quota, rate limiting, plain
 * permission denial) that all share the same HTTP status code and are only
 * distinguishable via the structured `reason` field.
 */
export function classifyDriveError(err: unknown): DriveErrorCategory {
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
  if (info.code === 404) return "DRIVE_FILE_NOT_FOUND";
  if (info.code === 403) return "DRIVE_PERMISSION_DENIED";
  return "DRIVE_DOWNLOAD_FAILED";
}

/**
 * Regular Google accounts have no service-account storage quota, so Drive
 * access uses OAuth2 (authorization-code + refresh token) acting as the
 * actual account that owns "Faculty Classroom Storage". See
 * app/api/auth/google for the one-time authorization flow that issues the
 * refresh token.
 *
 * Cached at module scope (one instance per warm process) instead of
 * constructing a fresh OAuth2Client per call. google-auth-library's
 * OAuth2Client already caches the short-lived access token it gets back and
 * only re-hits Google's token endpoint once that access token actually
 * expires (~1 hour) — but only if the SAME client instance is reused. The
 * previous version built a brand-new client (and therefore forced a brand
 *-new refresh-token exchange with Google) on every single Drive call, which
 * under real concurrent traffic meant a very high-frequency burst of
 * refresh-token exchanges against Google's token endpoint from a small
 * number of source IPs. That pattern — many rapid exchanges of the same
 * refresh token in a short window — is exactly what Google's abuse/security
 * heuristics are documented to flag as anomalous and can respond to by
 * revoking the token ("Token has been expired or revoked"), independent of
 * the token's normal validity window. This was directly observed during
 * diagnosis: a freshly-issued token worked correctly across dozens of Drive
 * calls, then started failing with invalid_grant within minutes, after
 * many separate short-lived clients had each independently re-exchanged it.
 * Reusing one client removes that self-inflicted load without changing any
 * other behavior.
 */
let cachedOAuth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;

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

/** Test-only escape hatch: drop the cached client (e.g. after rotating the
 *  refresh token within the same long-lived process) so the next call
 *  builds a fresh one from current env vars instead of reusing a stale
 *  instance. Not used by any request path. */
export function resetDriveAuthCache(): void {
  cachedOAuth2Client = null;
}

function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getAuth() });
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
  const drive = getDriveClient();
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
  const drive = getDriveClient();
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
      "[googleDrive] stage=upload_failed",
      { folderId, fileName, size: buffer.byteLength },
      sanitizeDriveError(err)
    );
    throw err;
  }
  if (!res.data.id) {
    console.error("[googleDrive] stage=upload_no_file_id", { folderId, fileName });
    throw new Error("Google Drive upload failed.");
  }
  return {
    id: res.data.id,
    name: res.data.name ?? fileName,
    mimeType: res.data.mimeType ?? mimeType,
    size: Number(res.data.size ?? buffer.byteLength),
  };
}

/**
 * Starts a Google Drive resumable-upload session and returns the session
 * URL Google issues — the browser then PUTs the file's bytes directly to
 * that URL (see docs/architecture note below), never through this server.
 *
 * WHY: Vercel Serverless Functions enforce a hard ~4.5MB request body
 * limit at the platform level, before a route handler even runs — proven
 * in production (a 6MB request to /api/files/upload came back
 * `413 FUNCTION_PAYLOAD_TOO_LARGE` from Vercel itself, with the actual
 * cutoff between 4MB and 4.4MB). uploadFile() above (buffer through this
 * server) is therefore only safe for uploads comfortably under that
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
}

export interface DriveFileMeta {
  name: string;
  mimeType: string;
}

export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  const drive = getDriveClient();
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
    console.error("[googleDrive] stage=get_meta_failed", { fileId }, sanitizeDriveError(err));
    throw err;
  }
}

export async function downloadFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
  const drive = getDriveClient();
  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );
    return res.data as unknown as NodeJS.ReadableStream;
  } catch (err) {
    console.error("[googleDrive] stage=download_failed", { fileId }, sanitizeDriveError(err));
    throw err;
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

export async function copyFile(
  fileId: string,
  newFolderId: string,
  newName?: string
): Promise<DriveFileResult> {
  const drive = getDriveClient();
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
}
