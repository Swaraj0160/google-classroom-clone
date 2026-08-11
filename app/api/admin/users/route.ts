import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/viewAs";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, roll_number")
      .order("full_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ users: data ?? [] });
  } catch (err) {
    console.error("[api/admin/users]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}
