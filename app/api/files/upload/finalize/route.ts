import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { classifyDriveError, getFileMeta } from "@/lib/server/googleDrive";
import { getViewedUserId, VIEW_ONLY_MESSAGE } from "@/lib/server/viewAs";

/**
 * Step 2 of 2 (see session/route.ts for step 1). The browser has already
 * PUT its file bytes directly to the Drive session URL from step 1 and
 * Drive has handed back a file id — but that id is client-reported and
 * never trusted on its own. This step independently re-fetches it from
 * Drive (the same "confirm the object is actually retrievable before
 * reporting success" guarantee the old single-request upload route had)
 * before the client is ever told it's safe to persist a DB reference to
 * it, and performs the replace-in-place DB update server-side when
 * repairing a previously-broken submission file.
 */
function finalizeFailureResponse(err: unknown): { status: number; error: string } {
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
    const driveFileId = body?.driveFileId;
    const replaceFileId = body?.replaceFileId;
    const assignmentId = body?.assignmentId;

    if (typeof driveFileId !== "string" || !driveFileId) {
      return NextResponse.json({ error: "Missing driveFileId." }, { status: 400 });
    }

    let meta;
    try {
      meta = await getFileMeta(driveFileId);
    } catch (err) {
      console.error(
        "[api/files/upload/finalize] stage=verify_failed",
        JSON.stringify({ driveFileId }),
        err instanceof Error ? err.message : err
      );
      const { status, error } = finalizeFailureResponse(err);
      return NextResponse.json({ error }, { status });
    }

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
