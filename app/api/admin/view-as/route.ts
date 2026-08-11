import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, VIEW_AS_COOKIE } from "@/lib/server/viewAs";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours — auto-expires a forgotten session

function auditLog(action: string, adminId: string, viewedUserId: string | null) {
  // No dedicated audit table exists in this project yet; structured server
  // log is captured by Vercel's function logs. No credentials are logged.
  console.log(
    JSON.stringify({
      audit: "view_as",
      action,
      adminId,
      viewedUserId,
      at: new Date().toISOString(),
    })
  );
}

/** Start viewing as a profile. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { viewedUserId } = await request.json().catch(() => ({ viewedUserId: null }));
  if (!viewedUserId || typeof viewedUserId !== "string") {
    return NextResponse.json({ error: "Missing viewedUserId." }, { status: 400 });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: target, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", viewedUserId)
      .maybeSingle();

    if (error) throw error;
    if (!target) {
      return NextResponse.json({ error: "That profile no longer exists." }, { status: 404 });
    }

    auditLog("view_as_started", admin.id, target.id);

    const res = NextResponse.json({ success: true, viewedUser: target });
    res.cookies.set(VIEW_AS_COOKIE, target.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    console.error("[api/admin/view-as] start", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start View As." }, { status: 500 });
  }
}

/** Exit View As. */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const viewedUserId = request.cookies.get(VIEW_AS_COOKIE)?.value ?? null;
  auditLog("view_as_ended", admin.id, viewedUserId);

  const res = NextResponse.json({ success: true });
  res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
