import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeCourseUpload, isEnrolledInCourse } from "@/lib/server/fileAuthorization";
import { getFileMeta, resolveFolderPath, sanitizeFolderName, uploadFile } from "@/lib/server/googleDrive";
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
    // Populated when mode === "submission", used only for the structured
    // [FILE_UPLOAD] log line below — never trusted for authorization, which
    // is already fully resolved by the time these are set.
    let logContext: { studentId?: string; courseId?: string; assignmentId?: string } = {};

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
      logContext = { courseId };
    } else if (mode === "submission") {
      const assignmentId = String(form.get("assignmentId") ?? "");
      const studentId = String(form.get("studentId") ?? "");
      if (!assignmentId || !studentId) {
        return NextResponse.json({ error: "Missing assignmentId/studentId." }, { status: 400 });
      }
      // The client-supplied studentId is never trusted as authoritative on
      // its own — it must match the authenticated session...
      if (studentId !== user.id) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

      // ...and the assignment must resolve, server-side, to a real course
      // the authenticated student is actually enrolled in. Without this, a
      // student could pass an arbitrary assignmentId and have their upload
      // filed under a class/assignment they have no relationship to.
      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .select("id, title, course_id")
        .eq("id", assignmentId)
        .maybeSingle();
      if (assignmentError || !assignment) {
        return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
      }
      if (!(await isEnrolledInCourse(supabase, assignment.course_id, user.id))) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

      const { data: course } = await supabase
        .from("courses")
        .select("title, division, semester")
        .eq("id", assignment.course_id)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, roll_number")
        .eq("id", user.id)
        .maybeSingle();

      // Folder names are purely for human browsing in Drive — the DB
      // (submission_files.file_path) always remains the source of truth for
      // which object a record actually points to, keyed by studentId so
      // re-runs land in the same folder even if the student's name/roll
      // changes later.
      const courseLabel = course
        ? sanitizeFolderName(
            `${course.title}${course.division ? ` (Div ${course.division})` : ""}${
              course.semester ? ` Sem ${course.semester}` : ""
            }`
          )
        : sanitizeFolderName(assignment.course_id);
      const assignmentLabel = sanitizeFolderName(`${assignment.title} [${assignmentId.slice(0, 8)}]`);
      const studentLabel = sanitizeFolderName(
        `${profile?.roll_number ? `${profile.roll_number} - ` : ""}${profile?.full_name ?? studentId.slice(0, 8)}`
      );

      folderSegments = ["submissions", courseLabel, assignmentLabel, studentLabel];
      logContext = { studentId, courseId: assignment.course_id, assignmentId };
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

    // Confirm the object Drive just handed back is actually retrievable
    // before it's ever reported to the client / persisted as a DB reference
    // — a file id that Drive returns but can't itself immediately re-fetch
    // must never be reported as a successful upload.
    try {
      await getFileMeta(uploaded.id);
    } catch (err) {
      console.error(
        "[api/files/upload] stage=post_upload_verify_failed",
        JSON.stringify({ driveFileId: uploaded.id, fileName: uploaded.name }),
        err instanceof Error ? err.message : err
      );
      return NextResponse.json({ error: "Upload could not be verified. Please try again." }, { status: 502 });
    }

    console.log(
      "[FILE_UPLOAD]",
      JSON.stringify({
        ...logContext,
        filename: uploaded.name,
        driveFileId: uploaded.id,
        status: "success",
      })
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
