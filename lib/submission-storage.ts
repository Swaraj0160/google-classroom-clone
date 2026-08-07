// ============================================================================
// STUDENT SUBMISSION SYSTEM — Storage Helper
// Bucket: submissions (private)
// Path:
// submissions/
//    assignment_id/
//       student_id/
//          uuid-filename.ext
// ============================================================================

import { supabase } from "@/lib/supabase";

const BUCKET = "submissions";

function buildPath(
  assignmentId: string,
  studentId: string,
  fileName: string
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  const unique =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${assignmentId}/${studentId}/${unique}-${safeName}`;
}

export interface UploadResult {
  path: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Upload single submission file
 */
export async function uploadSubmissionFile(
  assignmentId: string,
  studentId: string,
  file: File
): Promise<UploadResult> {
  const path = buildPath(assignmentId, studentId, file.name);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw error;

  return {
    path,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || "application/octet-stream",
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
 * Delete one file
 */
export async function deleteSubmissionFile(path: string): Promise<void> {
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

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(paths);

  if (error) throw error;
}

/**
 * Get signed URL
 */
export async function getSubmissionFileUrl(
  path: string,
  expiresInSeconds = 600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;

  return data.signedUrl;
}

/**
 * Download file
 */
export async function downloadSubmissionFile(
  path: string,
  fileName: string
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (error) throw error;

  const url = URL.createObjectURL(data);

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