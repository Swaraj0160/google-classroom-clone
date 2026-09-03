import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/viewAs";
import { checkDriveHealth } from "@/lib/server/googleDrive";
import { adminErrorResponse } from "@/lib/server/adminApiError";

/**
 * Admin-only Drive storage status: one minimal, safe `about.get` call (see
 * checkDriveHealth) reporting auth health and real quota. Never call this
 * from a non-admin-triggered code path or on a timer — it exists for a
 * human to check on demand, not to add to the app's background Drive call
 * volume.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  try {
    const health = await checkDriveHealth();
    return NextResponse.json(health);
  } catch (err) {
    return adminErrorResponse("api/admin/drive-health", err, "Could not check Drive status.");
  }
}
