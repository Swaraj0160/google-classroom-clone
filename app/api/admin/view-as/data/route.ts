import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getViewedUserId } from "@/lib/server/viewAs";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { adminErrorResponse } from "@/lib/server/adminApiError";

/**
 * Consolidated, read-only data bundle for the profile currently being
 * viewed via View As. Admin-only; uses the service-role client because the
 * real caller (the admin) has no RLS-granted access to another user's rows.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const viewedUserId = getViewedUserId(request);
  if (!viewedUserId) {
    return NextResponse.json({ error: "No active View As session." }, { status: 400 });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, roll_number, created_at")
      .eq("id", viewedUserId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ error: "That profile no longer exists." }, { status: 404 });
    }

    if (profile.role === "student") {
      const { data: enrollments } = await supabaseAdmin
        .from("enrollments")
        .select("course:courses(id, title, subject)")
        .eq("student_id", viewedUserId);

      const courses = (enrollments ?? []).map((e: any) => e.course).filter(Boolean);
      const courseIds = courses.map((c: any) => c.id);

      let assignments: any[] = [];
      let submissions: any[] = [];

      if (courseIds.length) {
        const { data: assignmentRows } = await supabaseAdmin
          .from("assignments")
          .select("id, title, due_date, total_marks, course_id, status")
          .in("course_id", courseIds)
          .eq("status", "published")
          .order("due_date", { ascending: true });
        assignments = assignmentRows ?? [];

        const assignmentIds = assignments.map((a) => a.id);
        if (assignmentIds.length) {
          const { data: submissionRows } = await supabaseAdmin
            .from("submissions")
            .select("*, files:submission_files(*)")
            .eq("student_id", viewedUserId)
            .in("assignment_id", assignmentIds);
          submissions = submissionRows ?? [];
        }
      }

      return NextResponse.json({ profile, courses, assignments, submissions });
    }

    if (profile.role === "faculty") {
      const { data: courseRows } = await supabaseAdmin
        .from("courses")
        .select("id, title, subject")
        .eq("faculty_id", viewedUserId);
      const courses = courseRows ?? [];
      const courseIds = courses.map((c) => c.id);

      let assignments: any[] = [];
      let students: any[] = [];
      let submissions: any[] = [];

      if (courseIds.length) {
        const [{ data: assignmentRows }, { data: enrollmentRows }] = await Promise.all([
          supabaseAdmin
            .from("assignments")
            .select("id, title, due_date, total_marks, course_id, status")
            .in("course_id", courseIds)
            .order("due_date", { ascending: true }),
          supabaseAdmin.from("enrollments").select("student_id").in("course_id", courseIds),
        ]);

        assignments = assignmentRows ?? [];

        const studentIds = [...new Set((enrollmentRows ?? []).map((e) => e.student_id))];
        if (studentIds.length) {
          const { data: studentRows } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, roll_number")
            .in("id", studentIds);
          students = studentRows ?? [];
        }

        const assignmentIds = assignments.map((a) => a.id);
        if (assignmentIds.length) {
          const { data: submissionRows } = await supabaseAdmin
            .from("submissions")
            .select("id, assignment_id, student_id, status, marks, submitted_at")
            .in("assignment_id", assignmentIds);
          submissions = submissionRows ?? [];
        }
      }

      return NextResponse.json({ profile, courses, assignments, students, submissions });
    }

    // Viewing another admin: no separate data model exists for admins yet —
    // just their profile.
    return NextResponse.json({ profile });
  } catch (err) {
    return adminErrorResponse("api/admin/view-as/data", err, "Failed to load view-as data.");
  }
}
