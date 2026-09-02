"use client";

/**
 * Shared upload path for every Drive-backed upload in the app (course
 * attachments, submissions, submission re-uploads). Bypasses Vercel's
 * ~4.5MB Serverless Function request-body limit — confirmed in production
 * (a 6MB upload returned Vercel's own `413 FUNCTION_PAYLOAD_TOO_LARGE`
 * before any application code ran) — by never sending file bytes to our
 * own server at all:
 *
 *   1. POST /api/files/upload/session — fully authorized/validated there
 *      (ownership, enrollment, folder resolution, size limits); returns a
 *      single-use Drive resumable-upload session URL scoped to exactly the
 *      right folder.
 *   2. PUT the file's bytes directly to that URL — Google's servers, not
 *      ours. Vercel is not in this request's path at all.
 *   3. POST /api/files/upload/finalize — re-verifies the resulting file is
 *      real (never trusts the client-reported id on its own) and, for a
 *      replaceFileId repair, updates that DB row server-side.
 *
 * See lib/server/googleDrive.ts's createResumableUploadSession for the
 * security model (why a client can't redirect the upload elsewhere or
 * exceed the size it was validated for).
 */

async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

export interface ResumableUploadRequest {
  mode: "course" | "submission";
  courseId?: string;
  scope?: string;
  assignmentId?: string;
  studentId?: string;
  replaceFileId?: string;
}

export interface ResumableUploadResponse {
  path: string;
  name: string;
  type: string;
  replaced?: boolean;
  file?: Record<string, unknown>;
}

export async function uploadFileToDrive(
  file: File,
  request: ResumableUploadRequest
): Promise<ResumableUploadResponse> {
  const sessionRes = await fetch("/api/files/upload/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
    }),
  });
  if (!sessionRes.ok) throw new Error(await readApiError(sessionRes, "Could not start the upload."));
  const { uploadUrl } = await sessionRes.json();
  if (!uploadUrl) throw new Error("Could not start the upload.");

  // Straight to Google, never through our own server — no Content-Length
  // header here: it's a forbidden header for fetch() to set manually, and
  // the browser sets it correctly from the File body automatically.
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Upload to storage failed. Please try again.");
  }
  const uploadedMeta = await putRes.json().catch(() => null);
  const driveFileId = uploadedMeta?.id;
  if (!driveFileId) throw new Error("Upload to storage failed. Please try again.");

  const finalizeRes = await fetch("/api/files/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      driveFileId,
      replaceFileId: request.replaceFileId,
      assignmentId: request.assignmentId,
    }),
  });
  if (!finalizeRes.ok) throw new Error(await readApiError(finalizeRes, "Upload could not be verified."));
  return finalizeRes.json();
}
