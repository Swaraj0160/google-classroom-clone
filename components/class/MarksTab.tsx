"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compareByRollNumber } from "@/lib/format";
import { exportMarksToExcel, exportMarksToPdf, type MarksExportRow } from "@/lib/export";
import { showToast } from "@/lib/toast";

interface MarksTabProps {
  courseId: string;
  courseName: string;
}

interface StudentRow {
  id: string;
  full_name: string | null;
  email: string;
  roll_number: string | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  total_marks: number | null;
  due_date: string | null;
  created_at: string;
}

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  marks: number | null;
  status: string;
  submitted_at: string | null;
  feedback: string | null;
}

function submissionTiming(submission: SubmissionRow | undefined, assignment: AssignmentRow): string {
  if (!submission || !submission.submitted_at) return "—";
  if (!assignment.due_date) return "On-time";
  return new Date(submission.submitted_at) > new Date(assignment.due_date) ? "Late" : "On-time";
}

function statusLabel(status: string): string {
  switch (status) {
    case "graded":
      return "Graded";
    case "submitted":
      return "Submitted";
    case "late":
      return "Late";
    default:
      return "Pending";
  }
}

function safeFileSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Class";
}

export default function MarksTab({ courseId, courseName }: MarksTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [{ data: enrollments, error: enrollError }, { data: assignmentRows, error: assignError }] =
        await Promise.all([
          supabase.from("enrollments").select("student_id").eq("course_id", courseId),
          supabase
            .from("assignments")
            .select("id, title, total_marks, due_date, created_at")
            .eq("course_id", courseId)
            .in("type", ["assignment", "quiz"])
            .not("total_marks", "is", null)
            .order("created_at", { ascending: true }),
        ]);

      if (cancelled) return;

      if (enrollError) {
        setError(enrollError.message);
        setLoading(false);
        return;
      }
      if (assignError) {
        setError(assignError.message);
        setLoading(false);
        return;
      }

      const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];
      const assignmentList = (assignmentRows ?? []) as AssignmentRow[];
      setAssignments(assignmentList);

      if (studentIds.length === 0) {
        setStudents([]);
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const assignmentIds = assignmentList.map((a) => a.id);

      // profiles (needs studentIds) and submissions (needs assignmentIds + studentIds)
      // don't depend on each other — fetch concurrently.
      const [{ data: profileRows, error: profilesError }, submissionsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, roll_number")
          .in("id", studentIds),
        assignmentIds.length > 0
          ? supabase
              .from("submissions")
              .select("id, assignment_id, student_id, marks, status, submitted_at, feedback")
              .in("assignment_id", assignmentIds)
              .in("student_id", studentIds)
          : Promise.resolve({ data: [] as SubmissionRow[], error: null }),
      ]);

      if (cancelled) return;

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      setStudents(((profileRows ?? []) as StudentRow[]).sort(compareByRollNumber));

      if (submissionsRes.error) {
        setError(submissionsRes.error.message);
        setLoading(false);
        return;
      }

      setSubmissions((submissionsRes.data ?? []) as SubmissionRow[]);
      setLoading(false);
    }

    if (courseId) load();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const submissionByKey = useMemo(() => {
    const map = new Map<string, SubmissionRow>();
    submissions.forEach((s) => map.set(`${s.student_id}:${s.assignment_id}`, s));
    return map;
  }, [submissions]);

  const studentStats = useMemo(() => {
    const map = new Map<string, { submitted: number; missing: number; onTime: number; late: number }>();
    students.forEach((student) => {
      let submitted = 0;
      let onTime = 0;
      let late = 0;
      assignments.forEach((a) => {
        const s = submissionByKey.get(`${student.id}:${a.id}`);
        const turnedIn = !!s && s.status !== "pending" && !!s.submitted_at;
        if (!turnedIn) return;
        submitted++;
        if (submissionTiming(s, a) === "Late") late++;
        else onTime++;
      });
      map.set(student.id, {
        submitted,
        missing: Math.max(0, assignments.length - submitted),
        onTime,
        late,
      });
    });
    return map;
  }, [students, assignments, submissionByKey]);

  const averages = useMemo(() => {
    const map = new Map<string, number | null>();
    students.forEach((student) => {
      const scored = assignments
        .map((a) => submissionByKey.get(`${student.id}:${a.id}`))
        .filter(
          (s): s is SubmissionRow => !!s && s.status === "graded" && s.marks !== null
        )
        .map((s) => {
          const assignment = assignments.find((a) => a.id === s.assignment_id);
          const total = assignment?.total_marks ?? 0;
          return total > 0 ? (Number(s.marks) / total) * 100 : null;
        })
        .filter((p): p is number => p !== null);

      map.set(student.id, scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null);
    });
    return map;
  }, [students, assignments, submissionByKey]);

  function buildExportRows(): MarksExportRow[] {
    const rows: MarksExportRow[] = [];
    students.forEach((student) => {
      assignments.forEach((assignment) => {
        const submission = submissionByKey.get(`${student.id}:${assignment.id}`);
        if (!submission) return;
        rows.push({
          studentName: student.full_name || student.email,
          rollNumber: student.roll_number ?? "—",
          assignmentTitle: assignment.title,
          marks: submission.marks !== null ? String(submission.marks) : "—",
          maxMarks: assignment.total_marks !== null ? String(assignment.total_marks) : "—",
          status: statusLabel(submission.status),
          timing: submissionTiming(submission, assignment),
          remarks: submission.feedback ?? "",
        });
      });
    });
    return rows;
  }

  function handleExportExcel() {
    const rows = buildExportRows();
    if (rows.length === 0) {
      showToast.error("No submission data to export yet.");
      return;
    }
    exportMarksToExcel(rows, `${safeFileSegment(courseName)}_Marks.xls`);
  }

  function handleExportPdf() {
    const rows = buildExportRows();
    if (rows.length === 0) {
      showToast.error("No submission data to export yet.");
      return;
    }
    exportMarksToPdf(rows, `${safeFileSegment(courseName)}_Marks.pdf`, `${courseName} — Marks`);
  }

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20">
        {error}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white py-20 text-center dark:border-white/10 dark:bg-surface-darkAlt">
        <p className="text-sm font-medium text-ink-faint">No students enrolled in this class yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-white">Marks</h2>
          <p className="text-xs text-ink-faint">
            {assignments.length === 0
              ? "No graded assignments or quizzes yet."
              : `${assignments.length} assignment${assignments.length === 1 ? "" : "s"} · ${students.length} student${students.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-soft shadow-soft transition-all duration-200 hover:bg-surface-alt dark:border-white/10 dark:bg-surface-darkAlt dark:text-gray-300"
          >
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-soft shadow-soft transition-all duration-200 hover:bg-surface-alt dark:border-white/10 dark:bg-surface-darkAlt dark:text-gray-300"
          >
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white py-20 text-center dark:border-white/10 dark:bg-surface-darkAlt">
          <p className="text-sm font-medium text-ink-faint">
            Create an assignment or quiz with total marks to start tracking marks here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-alt/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint dark:border-white/10 dark:bg-white/5">
                  <th className="sticky left-0 z-10 bg-surface-alt/60 px-4 py-3 dark:bg-white/5">Student</th>
                  {assignments.map((a) => (
                    <th key={a.id} className="whitespace-nowrap px-4 py-3 text-center">
                      {a.title}
                      <div className="text-[10px] font-normal normal-case text-ink-faint">/{a.total_marks}</div>
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-center">Submitted</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">Missing</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">On-time</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">Late</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {students.map((student) => (
                  <tr key={student.id} className="transition-colors hover:bg-surface-alt/60 dark:hover:bg-white/5">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-surface-darkAlt">
                      <p className="font-medium text-ink dark:text-white">
                        {student.full_name || student.email}
                      </p>
                      <p className="text-[11px] text-ink-faint">{student.roll_number ?? "—"}</p>
                    </td>
                    {assignments.map((a) => {
                      const submission = submissionByKey.get(`${student.id}:${a.id}`);
                      return (
                        <td key={a.id} className="px-4 py-3 text-center">
                          {submission?.status === "graded" && submission.marks !== null ? (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-brand-green dark:bg-green-500/10">
                              {submission.marks}/{a.total_marks}
                            </span>
                          ) : submission?.status === "late" ? (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-brand-red dark:bg-red-500/10">
                              Late
                            </span>
                          ) : submission?.status === "submitted" ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-brand-blue dark:bg-blue-500/10">
                              Submitted
                            </span>
                          ) : (
                            <span className="text-xs text-ink-faint">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                      {studentStats.get(student.id)?.submitted ?? 0}/{assignments.length}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(studentStats.get(student.id)?.missing ?? 0) > 0 ? (
                        <span className="font-medium text-brand-red">
                          {studentStats.get(student.id)?.missing}
                        </span>
                      ) : (
                        <span className="text-ink-soft dark:text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                      {studentStats.get(student.id)?.onTime ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(studentStats.get(student.id)?.late ?? 0) > 0 ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {studentStats.get(student.id)?.late}
                        </span>
                      ) : (
                        <span className="text-ink-soft dark:text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {averages.get(student.id) !== null && averages.get(student.id) !== undefined ? (
                        <span className="font-semibold text-ink dark:text-white">
                          {averages.get(student.id)}%
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
