import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeFileAccess } from "@/lib/server/fileAuthorization";
import { deleteFile } from "@/lib/server/googleDrive";
import { getViewedUserId, VIEW_ONLY_MESSAGE } from "@/lib/server/viewAs";

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

    const authorized = await authorizeFileAccess(supabase, fileId, user.id, "write");
    if (!authorized) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    await deleteFile(fileId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/files/delete]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
