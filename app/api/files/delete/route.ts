import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeFileForDelete, tableForResource } from "@/lib/server/fileAuthorization";
import { deleteFile } from "@/lib/server/googleDrive";
import { getViewedUserId, VIEW_ONLY_MESSAGE } from "@/lib/server/viewAs";

/**
 * Deletes a file reference as ONE server-side operation: authorize, delete
 * the DB row, then delete the Drive object — in that order, and only ever
 * from a single request/response round trip. This exists specifically to
 * prevent the class of bug found in production on 2026-08-20: the DB row
 * and the Drive object used to be deleted via two separate client-driven
 * calls (Drive first, DB row second), so a browser tab closing, a network
 * blip, or an RLS edge case between the two calls could leave the Drive
 * object permanently gone while the DB row survived, pointing at nothing —
 * surfacing later as "This file could not be found in storage."
 *
 * Doing the DB delete first and the Drive delete second means the worst
 * case on partial failure is a harmless orphaned Drive object (wasted
 * storage, never a broken reference) — never the reverse.
 */
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

    const { fileId } = await request.json();
    if (!fileId || typeof fileId !== "string") {
      return NextResponse.json({ error: "Missing fileId." }, { status: 400 });
    }

    const resource = await authorizeFileForDelete(supabase, fileId, user.id);
    if (!resource) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const table = tableForResource(resource.type);
    const { error: dbError } = await supabase.from(table).delete().eq("id", resource.rowId);
    if (dbError) {
      console.error(
        "[api/files/delete] stage=db_delete_failed",
        JSON.stringify({ table, rowId: resource.rowId, fileId }),
        dbError.message
      );
      return NextResponse.json({ error: "Delete failed. Please try again." }, { status: 500 });
    }

    try {
      await deleteFile(fileId);
    } catch (driveErr) {
      // DB row (the source of truth) is already gone, so nothing is
      // inconsistent — this just leaves an orphaned Drive object behind.
      console.error(
        "[api/files/delete] stage=drive_delete_failed_after_db_delete",
        JSON.stringify({ table, rowId: resource.rowId, fileId }),
        driveErr instanceof Error ? driveErr.message : driveErr
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/files/delete] stage=unexpected", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
