import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { checkResumableUploadStatus, classifyDriveError, DriveUploadIncompleteError } from "@/lib/server/googleDrive";
import { getViewedUserId, VIEW_ONLY_MESSAGE } from "@/lib/server/viewAs";

/**
 * Step 2 of 2 (see session/route.ts for step 1).
 *
 * Takes the session's uploadUrl (which the browser already has — it's not
 * new exposure) rather than a client-reported driveFileId. Proven during
 * production diagnosis: the browser's direct PUT to that URL is correctly
 * allowed by Google's CORS preflight, and Google does complete the upload,
 * but the actual PUT success response is missing
 * Access-Control-Allow-Origin (present only on the preflight), so the
 * browser's fetch() rejects with a bare "Failed to fetch" — even though
 * the file now exists in Drive. Trusting a driveFileId the browser claims
 * to have read out of that same blocked response meant this route could
 * never even be reached on a real (successful) upload. Instead,
 * checkResumableUploadStatus() re-queries the same session URL from this
 * server (a plain server-to-server request; CORS is a browser-only
 * mechanism) to authoritatively learn the real outcome — the browser's PUT
 * becomes best-effort/fire-and-forget, and this status check is the one
 * source of truth for whether a DB row is ever created.
 */
function finalizeFailureResponse(err: unknown): { status: number; error: string } {
  if (err instanceof DriveUploadIncompleteError) {
    return { status: 502, error: "The upload did not finish. Please try again." };
  }
  const category = classifyDriveError(err);
  if (category === "DRIVE_AUTH_FAILED") {
    return {
      status: 503,
      error: "Google Drive authentication has expired. Please contact your administrator to reconnect storage.",
    };
  }
  if (category === "DRIVE_FILE_NOT_FOUND") {
    return { status: 502, error: "Upload could not be verified — the file was not found in storage. Please try again." };
  }
  if (category === "DRIVE_NETWORK_ERROR") {
    return { status: 502, error: "Could not reach file storage to verify the upload. Please try again." };
  }
  return { status: 502, error: "Upload could not be verified. Please try again." };
}

export async function POST(request: NextRequest) {
  try {
    if (getViewedUserId(request)) {
      return NextResponse.json({ error: VIEW_ONLY_MESSAGE }, { status: 403 });
    }

    const supabase = createSupabaseRouteClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const uploadUrl = body?.uploadUrl;
    const totalBytes = Number(body?.totalBytes);
    const replaceFileId = body?.replaceFileId;
    const assignmentId = body?.assignmentId;

    if (typeof uploadUrl !== "string" || !uploadUrl) {
      return NextResponse.json({ error: "Missing uploadUrl." }, { status: 400 });
    }
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      return NextResponse.json({ error: "Missing or invalid totalBytes." }, { status: 400 });
    }
    // Basic SSRF guard: this route only ever PUTs to a Drive-issued upload
    // session URL, never to an arbitrary client-supplied host.
    let parsedUploadUrl: URL;
    try {
      parsedUploadUrl = new URL(uploadUrl);
    } catch {
      return NextResponse.json({ error: "Invalid uploadUrl." }, { status: 400 });
    }
    if (parsedUploadUrl.hostname !== "www.googleapis.com") {
      return NextResponse.json({ error: "Invalid uploadUrl." }, { status: 400 });
    }

    let file;
    try {
      file = await checkResumableUploadStatus(uploadUrl, totalBytes);
    } catch (err) {
      console.error(
        "[api/files/upload/finalize] stage=verify_failed",
        JSON.stringify({ totalBytes }),
        err instanceof Error ? err.message : err
      );
      const { status, error } = finalizeFailureResponse(err);
      return NextResponse.json({ error }, { status });
    }
    const driveFileId = file.id;
    const meta = { name: file.name, mimeType: file.mimeType };

    console.log(
      "[FILE_UPLOAD]",
      JSON.stringify({ userId: user.id, driveFileId, filename: meta.name, status: "success", replacesFileId: replaceFileId ?? undefined })
    );

    if (typeof replaceFileId === "string" && replaceFileId) {
      // Never trust that this request actually followed a legitimate
      // session/route.ts call for this exact row — re-verify ownership
      // independently, exactly as session/route.ts did, since a client
      // could call finalize directly with an arbitrary replaceFileId.
      const { data: targetFile } = await supabase
        .from("submission_files")
        .select("id, submission_id, submissions!inner(student_id, assignment_id)")
        .eq("id", replaceFileId)
        .maybeSingle();
      const owningSubmission = (
        targetFile as unknown as { submissions?: { student_id: string; assignment_id: string } } | null
      )?.submissions;
      if (
        !targetFile ||
        !owningSubmission ||
        owningSubmission.student_id !== user.id ||
        (typeof assignmentId === "string" && assignmentId && owningSubmission.assignment_id !== assignmentId)
      ) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

      const admin = createSupabaseAdminClient();
      const { data: updated, error: updateError } = await admin
        .from("submission_files")
        .update({
          file_name: meta.name,
          file_path: driveFileId,
          file_type: meta.mimeType,
          status: "reuploaded",
          status_updated_at: new Date().toISOString(),
        })
        .eq("id", replaceFileId)
        .select("id, submission_id, file_name, file_path, file_type, file_size, status, status_updated_at")
        .maybeSingle();

      if (updateError || !updated) {
        console.error(
          "[api/files/upload/finalize] stage=replace_row_update_failed",
          JSON.stringify({ replaceFileId, driveFileId }),
          updateError?.message
        );
        return NextResponse.json(
          { error: "Upload succeeded but the record could not be updated. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({ replaced: true, file: updated });
    }

    return NextResponse.json({
      path: driveFileId,
      name: meta.name,
      type: meta.mimeType,
    });
  } catch (err) {
    console.error("[api/files/upload/finalize] stage=unexpected", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Upload could not be verified. Please try again." }, { status: 500 });
  }
}
