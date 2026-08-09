import type { SupabaseClient } from "@supabase/supabase-js";

type ResourceType = "submission" | "assignment_attachment" | "announcement_attachment";

interface ResolvedFile {
  type: ResourceType;
  courseId: string;
  studentId?: string;
}

async function resolveFileResource(
  supabase: SupabaseClient,
  fileId: string
): Promise<ResolvedFile | null> {
  const { data: subFile } = await supabase
    .from("submission_files")
    .select("submission_id")
    .eq("file_path", fileId)
    .maybeSingle();

  if (subFile) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("student_id, assignment_id")
      .eq("id", subFile.submission_id)
      .maybeSingle();
    if (!submission) return null;

    const { data: assignment } = await supabase
      .from("assignments")
      .select("course_id")
      .eq("id", submission.assignment_id)
      .maybeSingle();
    if (!assignment) return null;

    return { type: "submission", courseId: assignment.course_id, studentId: submission.student_id };
  }

  const { data: asgAttach } = await supabase
    .from("assignment_attachments")
    .select("assignment_id")
    .eq("file_path", fileId)
    .maybeSingle();

  if (asgAttach) {
    const { data: assignment } = await supabase
      .from("assignments")
      .select("course_id")
      .eq("id", asgAttach.assignment_id)
      .maybeSingle();
    if (!assignment) return null;
    return { type: "assignment_attachment", courseId: assignment.course_id };
  }

  const { data: annAttach } = await supabase
    .from("announcement_attachments")
    .select("announcement_id")
    .eq("file_path", fileId)
    .maybeSingle();

  if (annAttach) {
    const { data: announcement } = await supabase
      .from("announcements")
      .select("course_id")
      .eq("id", annAttach.announcement_id)
      .maybeSingle();
    if (!announcement) return null;
    return { type: "announcement_attachment", courseId: announcement.course_id };
  }

  return null;
}

async function isFacultyOfCourse(
  supabase: SupabaseClient,
  courseId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("faculty_id", userId)
    .maybeSingle();
  return !!data;
}

async function isEnrolledInCourse(
  supabase: SupabaseClient,
  courseId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("student_id", userId)
    .maybeSingle();
  return !!data;
}

export type FileAction = "read" | "write";

/**
 * Replicates, in application code, the access boundaries Supabase Storage
 * RLS used to enforce: a student may read/write their own submission files
 * and read (not write) course attachments for classes they're enrolled in;
 * faculty may read/write attachments for courses they own and read (not
 * delete) their students' submission files. Never trusts the fileId alone.
 */
export async function authorizeFileAccess(
  supabase: SupabaseClient,
  fileId: string,
  userId: string,
  action: FileAction
): Promise<boolean> {
  const resource = await resolveFileResource(supabase, fileId);
  if (!resource) return false;

  if (resource.type === "submission") {
    if (resource.studentId === userId) return true;
    if (action === "read") return isFacultyOfCourse(supabase, resource.courseId, userId);
    return false;
  }

  if (action === "write") return isFacultyOfCourse(supabase, resource.courseId, userId);

  if (await isFacultyOfCourse(supabase, resource.courseId, userId)) return true;
  return isEnrolledInCourse(supabase, resource.courseId, userId);
}

export async function authorizeCourseUpload(
  supabase: SupabaseClient,
  courseId: string,
  userId: string
): Promise<boolean> {
  return isFacultyOfCourse(supabase, courseId, userId);
}
