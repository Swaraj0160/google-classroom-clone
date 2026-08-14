import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeCourseUpload } from "@/lib/server/fileAuthorization";
import { resolveFolderPath, uploadFile } from "@/lib/server/googleDrive";
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

    console.log(
      "[api/files/upload] stage=received",
      JSON.stringify({ mode, fileName: file.name, fileSize: file.size, userId: user.id })
    );

    const buffer = Buffer.from(await file.arrayBuffer());

    let folderId: string;
    try {
      folderId = await resolveFolderPath(folderSegments);
    } catch (err) {
      console.error(
        "[api/files/upload] stage=folder_resolve_failed",
        JSON.stringify({ folderSegments }),
        err instanceof Error ? err.message : err
      );
      const notConfigured = err instanceof Error && err.message.includes("not configured");
      return NextResponse.json(
        { error: notConfigured ? "File storage is not configured on the server." : "Upload failed. Please try again." },
        { status: notConfigured ? 503 : 502 }
      );
    }

    console.log("[api/files/upload] stage=folder_resolved", JSON.stringify({ folderId }));

    let uploaded;
    try {
      uploaded = await uploadFile(folderId, file.name, file.type, buffer);
    } catch (err) {
      console.error(
        "[api/files/upload] stage=drive_upload_failed",
        JSON.stringify({ folderId, fileName: file.name }),
        err instanceof Error ? err.message : err
      );
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
    }

    console.log(
      "[api/files/upload] stage=drive_upload_complete",
      JSON.stringify({ driveFileId: uploaded.id, fileName: uploaded.name })
    );

    return NextResponse.json({
      path: uploaded.id,
      name: uploaded.name,
      type: uploaded.mimeType || file.type || "application/octet-stream",
      size: uploaded.size || file.size,
    });
  } catch (err) {
    console.error("[api/files/upload] stage=unexpected", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
