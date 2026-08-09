import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

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
  if (!clientId || !clientSecret || !refreshToken) {
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
  if (!id) throw new Error("Google Drive is not configured on the server.");
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

/** Walks/creates a nested folder path under the app's root Drive folder. */
export async function resolveFolderPath(segments: string[]): Promise<string> {
  const drive = getDriveClient();
  let parentId = rootFolderId();
  for (const segment of segments) {
    if (!segment) continue;
    parentId = await getOrCreateFolder(drive, parentId, segment);
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
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
    fields: "id, name, mimeType, size",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("Google Drive upload failed.");
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
  const res = await drive.files.get({
    fileId,
    fields: "name, mimeType",
    supportsAllDrives: true,
  });
  return {
    name: res.data.name ?? "file",
    mimeType: res.data.mimeType ?? "application/octet-stream",
  };
}

export async function downloadFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return res.data as unknown as NodeJS.ReadableStream;
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
