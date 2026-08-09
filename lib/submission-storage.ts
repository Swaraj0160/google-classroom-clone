// ============================================================================
// STUDENT SUBMISSION SYSTEM — Storage Helper
// New uploads go to Google Drive via /api/files/*. Legacy files already in
// the "submissions" Supabase Storage bucket keep working through the
// original Supabase code path — see isDriveFileId().
// ============================================================================

"use client";

import { supabase } from "@/lib/supabase";

const BUCKET = "submissions";

function isDriveFileId(path: string): boolean {
  return !path.includes("/");
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

export interface UploadResult {
  path: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Upload single submission file (Google Drive, via the server API)
 */
export async function uploadSubmissionFile(
  assignmentId: string,
  studentId: string,
  file: File
): Promise<UploadResult> {
  const form = new FormData();
  form.append("mode", "submission");
  form.append("assignmentId", assignmentId);
  form.append("studentId", studentId);
  form.append("file", file);

  const res = await fetch("/api/files/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readApiError(res, "Upload failed."));

  const uploaded = await res.json();
  return {
    path: uploaded.path,
    fileName: uploaded.name ?? file.name,
    fileSize: uploaded.size ?? file.size,
    fileType: uploaded.type || file.type || "application/octet-stream",
  };
}

/**
 * Upload multiple files
 */
export async function uploadSubmissionFiles(
  assignmentId: string,
  studentId: string,
  files: File[]
): Promise<UploadResult[]> {
  return Promise.all(
    files.map((file) =>
      uploadSubmissionFile(assignmentId, studentId, file)
    )
  );
}

/**
 * Delete one file — hybrid-aware.
 */
export async function deleteSubmissionFile(path: string): Promise<void> {
  if (isDriveFileId(path)) {
    const res = await fetch("/api/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: path }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Delete failed."));
    return;
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) throw error;
}

/**
 * Delete many files
 */
export async function deleteSubmissionFiles(
  paths: string[]
): Promise<void> {
  if (!paths.length) return;
  await Promise.all(paths.map((p) => deleteSubmissionFile(p)));
}

/**
 * Get a URL to view/download a file — hybrid-aware.
 */
export async function getSubmissionFileUrl(
  path: string,
  expiresInSeconds = 600
): Promise<string> {
  if (isDriveFileId(path)) {
    return `/api/files/view/${encodeURIComponent(path)}`;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;

  return data.signedUrl;
}

/**
 * Download file — hybrid-aware.
 */
export async function downloadSubmissionFile(
  path: string,
  fileName: string
): Promise<void> {
  let blob: Blob;

  if (isDriveFileId(path)) {
    const res = await fetch(`/api/files/view/${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(await readApiError(res, "Download failed."));
    blob = await res.blob();
  } else {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(path);

    if (error) throw error;
    blob = data;
  }

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/**
 * Human readable file size
 */
export function formatFileSize(
  bytes: number | null | undefined
): string {
  if (!bytes) return "";

  const units = ["B", "KB", "MB", "GB"];

  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}
