import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeCourseUpload } from "@/lib/server/fileAuthorization";
import { resolveFolderPath, uploadFile } from "@/lib/server/googleDrive";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const mode = form.get("mode");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    let folderSegments: string[];

    if (mode === "course") {
      const courseId = String(form.get("courseId") ?? "");
      const scope = String(form.get("scope") ?? "");
      if (!courseId || !scope) {
        return NextResponse.json({ error: "Missing courseId/scope." }, { status: 400 });
      }
      if (!(await authorizeCourseUpload(supabase, courseId, user.id))) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
      folderSegments = ["courses", courseId, ...scope.split("/")];
    } else if (mode === "submission") {
      const assignmentId = String(form.get("assignmentId") ?? "");
      const studentId = String(form.get("studentId") ?? "");
      if (!assignmentId || !studentId) {
        return NextResponse.json({ error: "Missing assignmentId/studentId." }, { status: 400 });
      }
      if (studentId !== user.id) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
      folderSegments = ["submissions", assignmentId, studentId];
    } else {
      return NextResponse.json({ error: "Invalid upload mode." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folderId = await resolveFolderPath(folderSegments);
    const uploaded = await uploadFile(folderId, file.name, file.type, buffer);

    return NextResponse.json({
      path: uploaded.id,
      name: uploaded.name,
      type: uploaded.mimeType || file.type || "application/octet-stream",
      size: uploaded.size || file.size,
    });
  } catch (err) {
    console.error("[api/files/upload]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
