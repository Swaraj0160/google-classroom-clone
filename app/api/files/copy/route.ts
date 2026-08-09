import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeFileAccess, authorizeCourseUpload } from "@/lib/server/fileAuthorization";
import { resolveFolderPath, copyFile } from "@/lib/server/googleDrive";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { fileId, courseId, scope } = await request.json();
    if (!fileId || !courseId || !scope) {
      return NextResponse.json({ error: "Missing fileId/courseId/scope." }, { status: 400 });
    }

    const [canRead, canWriteTarget] = await Promise.all([
      authorizeFileAccess(supabase, fileId, user.id, "read"),
      authorizeCourseUpload(supabase, courseId, user.id),
    ]);
    if (!canRead || !canWriteTarget) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const folderId = await resolveFolderPath(["courses", courseId, ...String(scope).split("/")]);
    const copied = await copyFile(fileId, folderId);

    return NextResponse.json({
      path: copied.id,
      name: copied.name,
      type: copied.mimeType,
      size: copied.size,
    });
  } catch (err) {
    console.error("[api/files/copy]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Copy failed." }, { status: 500 });
  }
}
