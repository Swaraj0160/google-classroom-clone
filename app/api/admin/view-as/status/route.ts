import { NextRequest, NextResponse } from "next/server";
import { getRealUser, getViewedUserId, VIEW_AS_COOKIE } from "@/lib/server/viewAs";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

/**
 * Reports current View As state for the banner/UI. Contains no secrets, so
 * it's safe for any authenticated user — but only ever reflects the REAL
 * user's own cookie, and only admins can have set one via the start route.
 */
export async function GET(request: NextRequest) {
  const real = await getRealUser(request);
  if (!real) {
    return NextResponse.json({ active: false, viewedUser: null });
  }

  const viewedUserId = getViewedUserId(request);
  if (real.role !== "admin" || !viewedUserId) {
    return NextResponse.json({ active: false, viewedUser: null });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: viewedUser } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, roll_number")
      .eq("id", viewedUserId)
      .maybeSingle();

    if (!viewedUser) {
      // Viewed profile was deleted mid-session — clear the stale cookie.
      const res = NextResponse.json({ active: false, viewedUser: null });
      res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    return NextResponse.json({ active: true, viewedUser });
  } catch (err) {
    console.error("[api/admin/view-as/status]", err instanceof Error ? err.message : err);
    return NextResponse.json({ active: false, viewedUser: null });
  }
}
