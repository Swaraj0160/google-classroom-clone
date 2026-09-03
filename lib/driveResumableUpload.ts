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
 *   3. POST /api/files/upload/finalize — authoritatively determines the
 *      real outcome server-side and, for a replaceFileId repair, updates
 *      that DB row server-side.
 *
 * Step 2's response is deliberately NOT trusted, and a thrown error from
 * it is NOT treated as fatal — proven during production diagnosis: Google
 * correctly answers the CORS preflight for this PUT (allowing it), and the
 * PUT itself does complete the upload, but its actual success response is
 * missing Access-Control-Allow-Origin (present only on the preflight), so
 * the browser's fetch() rejects with a bare "Failed to fetch" regardless
 * of whether the upload actually worked. Reading anything from that
 * response — status, body, whether the promise even resolved — is
 * unreliable by design of Google's endpoint, not a bug in this file. Step
 * 3 is what actually determines success: it re-queries the same session
 * URL from the server, where CORS does not apply, and is the one place a
 * DB row ever gets written from.
 *
 * See lib/server/googleDrive.ts's createResumableUploadSession and
 * checkResumableUploadStatus for the full security/CORS explanation.
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

  // Best-effort: straight to Google, never through our own server. Do NOT
  // treat a thrown error (or any part of the response) as meaningful — see
  // the file-level doc comment above for exactly why that's unreliable
  // here. No Content-Length header: it's a forbidden header for fetch() to
  // set manually, and the browser sets it correctly from the File body.
  try {
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  } catch {
    // Expected in the common case — see doc comment. Fall through to
    // finalize regardless, which is the actual source of truth.
  }

  const finalizeRes = await fetch("/api/files/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadUrl,
      totalBytes: file.size,
      replaceFileId: request.replaceFileId,
      assignmentId: request.assignmentId,
    }),
  });
  if (!finalizeRes.ok) throw new Error(await readApiError(finalizeRes, "Upload could not be verified."));
  return finalizeRes.json();
}
