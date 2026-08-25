"use client";

import { supabase } from "@/lib/supabase";
import { isDriveFileId } from "@/lib/isDriveFileId";

export const CLASSROOM_BUCKET = "classroom-files";

// Adjust to your requirements — spec says "configurable".
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export interface UploadedFile {
  path: string;
  name: string;
  type: string;
  size: number;
}

export function assertFileSize(file: File) {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 25MB upload limit.`);
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

/**
 * Uploads a new file to Google Drive via the server API (courseId/scope
 * decide the Drive folder: courses/{courseId}/{scope}). The browser never
 * talks to Google/Supabase Storage directly for new uploads.
 */
export async function uploadCourseFile(
  courseId: string,
  scope: string,
  file: File
): Promise<UploadedFile> {
  assertFileSize(file);

  const form = new FormData();
  form.append("mode", "course");
  form.append("courseId", courseId);
  form.append("scope", scope);
  form.append("file", file);

  const res = await fetch("/api/files/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readApiError(res, "Upload failed."));
  return res.json();
}

/**
 * Returns a URL the browser can open/fetch to view or download a file.
 * Drive files are served through our own authenticated API route; legacy
 * files keep using a Supabase signed URL exactly as before.
 */
export async function getSignedFileUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (isDriveFileId(path)) {
    return `/api/files/view/${encodeURIComponent(path)}`;
  }

  const { data, error } = await supabase.storage
    .from(CLASSROOM_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Fetches a course/attachment file's actual bytes for preview/download,
 * validating the HTTP response before ever treating it as binary content.
 *
 * This exists because a failure from /api/files/view/[fileId] (Drive file
 * genuinely missing, Drive credentials expired, not authorized, etc.) comes
 * back as a normal-looking response with a JSON error body — `res.blob()`
 * doesn't care what's inside, so calling it without checking `res.ok` first
 * turns that error message into a "file" the browser will happily save
 * under the real filename (e.g. a few dozen bytes of `{"error":"..."}`
 * saved as "assignment.docx"), which then fails to open and looks like
 * corruption. lib/submission-storage.ts's downloadSubmissionFile already
 * checks this; this is the equivalent for course/assignment/announcement
 * attachments, used by both preview and download so there's exactly one
 * correct binary-retrieval path instead of one per file type.
 */
export async function fetchCourseFileBlob(path: string): Promise<Blob> {
  const url = await getSignedFileUrl(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(await readApiError(res, "Could not load this file."));
  return res.blob();
}

export async function downloadCourseFile(path: string, fileName: string): Promise<void> {
  const blob = await fetchCourseFileBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteCourseFile(path: string): Promise<void> {
  if (isDriveFileId(path)) {
    const res = await fetch("/api/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: path }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Delete failed."));
    return;
  }

  const { error } = await supabase.storage.from(CLASSROOM_BUCKET).remove([path]);
  if (error) throw error;
}

/**
 * Copies a file into a new course/scope location — used by assignment
 * duplication. Hybrid-aware: copies within Drive, or within Supabase
 * Storage, depending on where the source file actually lives.
 */
export async function copyCourseFile(
  sourcePath: string,
  courseId: string,
  scope: string,
  fileName: string
): Promise<UploadedFile> {
  if (isDriveFileId(sourcePath)) {
    const res = await fetch("/api/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: sourcePath, courseId, scope }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Copy failed."));
    return res.json();
  }

  const newPath = `${courseId}/${scope}/${fileName}`;
  const { error } = await supabase.storage.from(CLASSROOM_BUCKET).copy(sourcePath, newPath);
  if (error) throw error;
  return { path: newPath, name: fileName, type: "", size: 0 };
}
