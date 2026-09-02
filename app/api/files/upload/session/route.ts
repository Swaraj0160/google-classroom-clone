import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeCourseUpload, isEnrolledInCourse } from "@/lib/server/fileAuthorization";
import {
  classifyDriveError,
  createResumableUploadSession,
  resolveFolderPath,
  sanitizeFolderName,
} from "@/lib/server/googleDrive";
import { checkSubmissionFileSize } from "@/lib/fileValidation";
import { getViewedUserId, VIEW_ONLY_MESSAGE } from "@/lib/server/viewAs";

// Mirrors lib/storage.ts's MAX_UPLOAD_SIZE_BYTES (kept as a separate literal
// here rather than importing that "use client" module into a route handler).
const COURSE_FILE_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Step 1 of 2 for every upload (see finalize/route.ts for step 2).
 *
 * Vercel Serverless Functions enforce a hard ~4.5MB request body limit at
 * the platform level — proven in production, independent of anything this
 * app controls (see lib/server/googleDrive.ts's createResumableUploadSession
 * doc comment). Routing file bytes through this server therefore cannot
 * reliably support the sizes this app already advertises (documents up to
 * 10MB, archives/video up to 25MB). Instead: this route does ALL the same
 * authorization/enrollment/folder-resolution/size-limit checks the old
 * single-request upload did, then asks Drive to open a resumable upload
 * session and hands the browser back a session URL to PUT bytes to
 * directly — those bytes never pass through this server or Vercel's body
 * limit at all.
 */
function sanitizedSessionFailure(err: unknown): { status: number; error: string } {
  const category = classifyDriveError(err);
  if (category === "DRIVE_AUTH_FAILED") {
    return {
      status: 503,
      error: "Google Drive authentication has expired. Please contact your administrator to reconnect storage.",
    };
  }
  if (category === "DRIVE_STORAGE_QUOTA_EXCEEDED") {
    return { status: 503, error: "Storage quota has been exceeded. Please contact your administrator." };
  }
  if (category === "DRIVE_RATE_LIMITED") {
    return { status: 503, error: "File storage is temporarily busy. Please try again in a moment." };
  }
  if (category === "DRIVE_PERMISSION_DENIED") {
    return { status: 503, error: "File storage access was denied. Please contact your administrator." };
  }
  return { status: 502, error: "Could not start the upload. Please try again." };
}

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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const mode = body.mode;
    const fileName = String(body.fileName ?? "");
    const fileType = String(body.fileType ?? "application/octet-stream");
    const fileSize = Number(body.fileSize);

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "Missing or invalid file metadata." }, { status: 400 });
    }

    let folderSegments: string[];
    let replaceFileId: string | null = null;

    if (mode === "course") {
      const courseId = String(body.courseId ?? "");
      const scope = String(body.scope ?? "");
      if (!courseId || !scope) {
        return NextResponse.json({ error: "Missing courseId/scope." }, { status: 400 });
      }
      if (!(await authorizeCourseUpload(supabase, courseId, user.id))) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
      if (fileSize > COURSE_FILE_MAX_BYTES) {
        return NextResponse.json(
          { error: `"${fileName}" exceeds the ${COURSE_FILE_MAX_BYTES / (1024 * 1024)}MB upload limit.` },
          { status: 400 }
        );
      }
      folderSegments = ["courses", courseId, ...scope.split("/")];
    } else if (mode === "submission") {
      const assignmentId = String(body.assignmentId ?? "");
      const studentId = String(body.studentId ?? "");
      if (!assignmentId || !studentId) {
        return NextResponse.json({ error: "Missing assignmentId/studentId." }, { status: 400 });
      }
      if (studentId !== user.id) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

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

      const sizeCheck = checkSubmissionFileSize({ name: fileName, type: fileType, size: fileSize });
      if (!sizeCheck.valid) {
        return NextResponse.json({ error: sizeCheck.message }, { status: 400 });
      }

      const requestedReplaceFileId = body.replaceFileId;
      if (typeof requestedReplaceFileId === "string" && requestedReplaceFileId) {
        const { data: targetFile } = await supabase
          .from("submission_files")
          .select("id, submission_id, submissions!inner(student_id, assignment_id)")
          .eq("id", requestedReplaceFileId)
          .maybeSingle();
        const owningSubmission = (
          targetFile as unknown as { submissions?: { student_id: string; assignment_id: string } } | null
        )?.submissions;
        if (
          !targetFile ||
          !owningSubmission ||
          owningSubmission.student_id !== user.id ||
          owningSubmission.assignment_id !== assignmentId
        ) {
          return NextResponse.json({ error: "Not authorized." }, { status: 403 });
        }
        replaceFileId = requestedReplaceFileId;
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
    } else {
      return NextResponse.json({ error: "Invalid upload mode." }, { status: 400 });
    }

    console.log(
      "[api/files/upload/session] stage=received",
      JSON.stringify({ mode, fileName, fileSize, userId: user.id })
    );

    let folderId: string;
    try {
      folderId = await resolveFolderPath(folderSegments);
    } catch (err) {
      console.error(
        "[api/files/upload/session] stage=folder_resolve_failed",
        JSON.stringify({ folderSegments }),
        err instanceof Error ? err.message : err
      );
      const notConfigured = err instanceof Error && err.message.includes("not configured");
      if (notConfigured) {
        return NextResponse.json({ error: "File storage is not configured on the server." }, { status: 503 });
      }
      const { status, error } = sanitizedSessionFailure(err);
      return NextResponse.json({ error }, { status });
    }

    let session;
    try {
      session = await createResumableUploadSession(folderId, fileName, fileType, fileSize);
    } catch (err) {
      const { status, error } = sanitizedSessionFailure(err);
      return NextResponse.json({ error }, { status });
    }

    console.log("[api/files/upload/session] stage=session_created", JSON.stringify({ folderId }));

    return NextResponse.json({
      uploadUrl: session.uploadUrl,
      replaceFileId,
    });
  } catch (err) {
    console.error("[api/files/upload/session] stage=unexpected", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
}
