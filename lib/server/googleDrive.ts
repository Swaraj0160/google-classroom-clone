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
  | "DRIVE_DOWNLOAD_FAILED";

/**
 * Buckets a Drive/OAuth error into one of the categories callers (currently
 * app/api/files/view/[fileId]/route.ts) use to pick a response that doesn't
 * lie to the user — an expired/revoked refresh token must never be reported
 * as "file not found", since the file may be perfectly fine.
 */
export function classifyDriveError(err: unknown): DriveErrorCategory {
  const info = sanitizeDriveError(err);
  if (info.reason === "invalid_grant" || info.code === 401) return "DRIVE_AUTH_FAILED";
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
 */
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

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
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
