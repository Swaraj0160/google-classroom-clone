"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compareByRollNumber } from "@/lib/format";
import { exportGradebookToExcel, exportGradebookToPdf } from "@/lib/export";
import { showToast } from "@/lib/toast";
import { calculateSubmissionGrade } from "@/lib/grading";

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

type GradeCellKind = "graded" | "not_graded" | "not_submitted";

interface GradeCell {
  kind: GradeCellKind;
  marks: number | null;
  maxMarks: number | null;
  suggestedMarks: number | null;
  submissionId: string | null;
}

/**
 * The ONE place a submission+assignment pair turns into a gradebook cell —
 * used for both the on-screen table and the Excel/PDF export, so they can
 * never disagree. A submission existing (even "on time") never implies
 * graded; only submissions.status === "graded" with a real marks value is
 * ever displayed as an official mark.
 */
function classifyCell(submission: SubmissionRow | undefined, assignment: AssignmentRow): GradeCell {
  const turnedIn = !!submission && submission.status !== "pending" && !!submission.submitted_at;
  if (!turnedIn) {
    return { kind: "not_submitted", marks: null, maxMarks: assignment.total_marks, suggestedMarks: null, submissionId: null };
  }
  if (submission!.status === "graded" && submission!.marks !== null) {
    return {
      kind: "graded",
      marks: submission!.marks,
      maxMarks: assignment.total_marks,
      suggestedMarks: null,
      submissionId: submission!.id,
    };
  }
  const { suggestedMarks } = calculateSubmissionGrade({
    dueAt: assignment.due_date,
    submittedAt: submission!.submitted_at,
    maxMarks: assignment.total_marks,
  });
  return {
    kind: "not_graded",
    marks: null,
    maxMarks: assignment.total_marks,
    suggestedMarks,
    submissionId: submission!.id,
  };
}

function cellExportText(cell: GradeCell): string {
  if (cell.kind === "not_submitted") return "—";
  // Official awarded marks only — the maximum is already in the column
  // header, so it isn't repeated in every cell.
  if (cell.kind === "graded") return `${cell.marks}`;
  return "Not Graded";
}

function safeFileSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Class";
}

type GradeFilter = "all" | "needs_grading" | "graded";

export default function MarksTab({ courseId, courseName }: MarksTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");

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

  // Assignment columns actually shown — either all of them, or the single
  // one picked in the "Assignment" filter.
  const visibleAssignments = useMemo(
    () => (assignmentFilter === "all" ? assignments : assignments.filter((a) => a.id === assignmentFilter)),
    [assignments, assignmentFilter]
  );

  // One cell-classification pass per student, reused by rendering, search/
  // filter, averages, and export — computed once, not recomputed per column.
  const cellsByStudent = useMemo(() => {
    const map = new Map<string, GradeCell[]>();
    students.forEach((student) => {
      map.set(
        student.id,
        visibleAssignments.map((a) => classifyCell(submissionByKey.get(`${student.id}:${a.id}`), a))
      );
    });
    return map;
  }, [students, visibleAssignments, submissionByKey]);

  const studentAverage = useMemo(() => {
    const map = new Map<string, number | null>();
    students.forEach((student) => {
      const graded = (cellsByStudent.get(student.id) ?? []).filter(
        (c) => c.kind === "graded" && c.maxMarks !== null && c.maxMarks > 0
      );
      const percentages = graded.map((c) => (Number(c.marks) / (c.maxMarks as number)) * 100);
      map.set(
        student.id,
        percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null
      );
    });
    return map;
  }, [students, cellsByStudent]);

  // Assignment-wise average row — official awarded marks only; ungraded and
  // not-submitted are excluded entirely, never treated as zero.
  const assignmentAverage = useMemo(() => {
    return visibleAssignments.map((a) => {
      const graded = students
        .map((student) => submissionByKey.get(`${student.id}:${a.id}`))
        .filter((s): s is SubmissionRow => !!s && s.status === "graded" && s.marks !== null);
      if (graded.length === 0) return null;
      const avg = graded.reduce((sum, s) => sum + Number(s.marks), 0) / graded.length;
      return avg;
    });
  }, [visibleAssignments, students, submissionByKey]);

  const classSummary = useMemo(() => {
    let graded = 0;
    let pendingReview = 0;
    const percentages: number[] = [];

    submissions.forEach((s) => {
      const turnedIn = s.status !== "pending" && !!s.submitted_at;
      if (!turnedIn) return;
      if (s.status === "graded" && s.marks !== null) {
        graded++;
        const assignment = assignments.find((a) => a.id === s.assignment_id);
        const total = assignment?.total_marks ?? 0;
        if (total > 0) percentages.push((Number(s.marks) / total) * 100);
      } else {
        pendingReview++;
      }
    });

    const turnedInTotal = graded + pendingReview;

    return {
      totalStudents: students.length,
      totalAssignments: assignments.length,
      gradedPercent: turnedInTotal > 0 ? Math.round((graded / turnedInTotal) * 100) : null,
      graded,
      pendingReview,
      classAverage: percentages.length
        ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
        : null,
    };
  }, [submissions, assignments, students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((student) => {
      if (q) {
        const matches =
          (student.full_name ?? "").toLowerCase().includes(q) ||
          student.email.toLowerCase().includes(q) ||
          (student.roll_number ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (gradeFilter === "all") return true;
      const cells = cellsByStudent.get(student.id) ?? [];
      const hasNeedsGrading = cells.some((c) => c.kind === "not_graded");
      const hasAnySubmission = cells.some((c) => c.kind !== "not_submitted");
      if (gradeFilter === "needs_grading") return hasNeedsGrading;
      // "graded" = has submitted work and none of it is awaiting review
      return hasAnySubmission && !hasNeedsGrading;
    });
  }, [students, search, gradeFilter, cellsByStudent]);

  function buildExportTable(): { headers: string[]; rows: string[][]; footer: string[] } {
    const headers = [
      "Student Name",
      "Roll No.",
      ...visibleAssignments.map((a) => `${a.title}${a.total_marks !== null ? ` (/${a.total_marks})` : ""}`),
      "Average",
    ];

    const rows = filteredStudents.map((student) => {
      const cells = cellsByStudent.get(student.id) ?? [];
      const avg = studentAverage.get(student.id);
      return [
        student.full_name || student.email,
        student.roll_number?.trim() || "Not set",
        ...cells.map(cellExportText),
        avg !== null && avg !== undefined ? `${avg}%` : "—",
      ];
    });

    const footer = [
      "Average",
      "",
      ...assignmentAverage.map((avg, i) =>
        avg !== null ? `${avg.toFixed(1)}${visibleAssignments[i].total_marks !== null ? `/${visibleAssignments[i].total_marks}` : ""}` : "—"
      ),
      "",
    ];

    return { headers, rows, footer };
  }

  function handleExportExcel() {
    if (filteredStudents.length === 0) {
      showToast.error("No students to export.");
      return;
    }
    const { headers, rows, footer } = buildExportTable();
    exportGradebookToExcel(headers, rows, footer, `${safeFileSegment(courseName)}_Gradebook.xls`, "Gradebook");
  }

  function handleExportPdf() {
    if (filteredStudents.length === 0) {
      showToast.error("No students to export.");
      return;
    }
    const { headers, rows, footer } = buildExportTable();
    exportGradebookToPdf(headers, rows, footer, `${safeFileSegment(courseName)}_Gradebook.pdf`, `${courseName} — Gradebook`);
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
          <h2 className="text-lg font-semibold text-ink dark:text-white">Gradebook</h2>
          <p className="text-xs text-ink-faint">
            {assignments.length === 0
              ? "No assignments with marks yet."
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

      {assignments.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MarksSummaryTile label="Total Students" value={classSummary.totalStudents} />
          <MarksSummaryTile label="Assignments" value={classSummary.totalAssignments} />
          <MarksSummaryTile
            label="Graded"
            value={classSummary.gradedPercent !== null ? `${classSummary.gradedPercent}%` : "—"}
            tone="green"
          />
          <MarksSummaryTile label="Pending Review" value={classSummary.pendingReview} tone="amber" />
          <MarksSummaryTile
            label="Class Average"
            value={classSummary.classAverage !== null ? `${classSummary.classAverage}%` : "—"}
            tone="purple"
          />
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white py-20 text-center dark:border-white/10 dark:bg-surface-darkAlt">
          <p className="text-sm font-medium text-ink-faint">
            Create an assignment or quiz with total marks to start tracking marks here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or roll number..."
                className="w-full rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt"
              />
            </div>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-ink-soft outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt dark:text-gray-300"
            >
              <option value="all">All Assignments</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {(
                [
                  ["all", "All"],
                  ["needs_grading", "Needs Grading"],
                  ["graded", "Graded"],
                ] as [GradeFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setGradeFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    gradeFilter === key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white py-12 text-center dark:border-white/10 dark:bg-surface-darkAlt">
              <p className="text-sm text-ink-faint">No students match your search/filter.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-surface-alt/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint dark:border-white/10 dark:bg-white/5">
                      <th className="sticky left-0 top-0 z-20 min-w-[180px] bg-surface-alt/60 px-4 py-3 dark:bg-[#1c2333]">
                        Student
                      </th>
                      <th className="sticky left-[180px] top-0 z-20 min-w-[90px] bg-surface-alt/60 px-4 py-3 dark:bg-[#1c2333]">
                        Roll No.
                      </th>
                      {visibleAssignments.map((a) => (
                        <th
                          key={a.id}
                          title={a.title}
                          className="sticky top-0 z-10 min-w-[110px] max-w-[160px] bg-surface-alt/60 px-3 py-3 text-center normal-case dark:bg-[#1c2333]"
                        >
                          <p className="line-clamp-2 text-[11px] font-semibold uppercase tracking-wide text-ink dark:text-white">
                            {a.title}
                          </p>
                          <p className="text-[10px] font-normal text-ink-faint">/{a.total_marks}</p>
                        </th>
                      ))}
                      <th className="sticky top-0 z-10 min-w-[80px] bg-surface-alt/60 px-4 py-3 text-center dark:bg-[#1c2333]">
                        Average
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/10">
                    {filteredStudents.map((student) => {
                      const cells = cellsByStudent.get(student.id) ?? [];
                      const avg = studentAverage.get(student.id);
                      return (
                        <tr key={student.id} className="transition-colors hover:bg-surface-alt/60 dark:hover:bg-white/5">
                          <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-surface-darkAlt">
                            <p className="truncate font-medium text-ink dark:text-white">
                              {student.full_name || student.email}
                            </p>
                          </td>
                          <td className="sticky left-[180px] z-10 bg-white px-4 py-3 dark:bg-surface-darkAlt">
                            <span
                              className={
                                student.roll_number
                                  ? "text-[12px] text-ink-soft dark:text-gray-400"
                                  : "text-[11px] font-medium text-amber-600 dark:text-amber-400"
                              }
                            >
                              {student.roll_number || "Not set"}
                            </span>
                          </td>
                          {visibleAssignments.map((a, i) => {
                            const cell = cells[i];
                            const content =
                              cell.kind === "graded" ? (
                                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-brand-green dark:bg-green-500/10">
                                  {cell.marks}
                                </span>
                              ) : cell.kind === "not_graded" ? (
                                <div>
                                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                    Not Graded
                                  </span>
                                  {cell.suggestedMarks !== null && (
                                    <p className="mt-1 text-[10px] text-ink-faint">
                                      Suggested {cell.suggestedMarks}/{cell.maxMarks}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-ink-faint">—</span>
                              );

                            return (
                              <td key={a.id} className="px-3 py-3 text-center">
                                {cell.submissionId ? (
                                  <Link
                                    href={`/dashboard/submissions/${cell.submissionId}`}
                                    className="inline-block rounded-lg transition-opacity hover:opacity-75"
                                  >
                                    {content}
                                  </Link>
                                ) : (
                                  content
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            {avg !== null && avg !== undefined ? (
                              <span className="font-semibold text-ink dark:text-white">{avg}%</span>
                            ) : (
                              <span className="text-xs text-ink-faint">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-black/10 bg-surface-alt/40 dark:border-white/10 dark:bg-white/5">
                      <td className="sticky left-0 z-10 bg-surface-alt/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint dark:bg-[#1c2333]">
                        Average
                      </td>
                      <td className="sticky left-[180px] z-10 bg-surface-alt/40 px-4 py-3 dark:bg-[#1c2333]" />
                      {visibleAssignments.map((a, i) => (
                        <td key={a.id} className="px-3 py-3 text-center text-xs font-semibold text-ink dark:text-white">
                          {assignmentAverage[i] !== null ? `${assignmentAverage[i]!.toFixed(1)}/${a.total_marks}` : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MarksSummaryTile({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number | string;
  tone?: "gray" | "green" | "amber" | "purple";
}) {
  const tones: Record<string, string> = {
    gray: "bg-surface-alt text-ink dark:bg-white/5 dark:text-white",
    green: "bg-green-50 text-brand-green dark:bg-green-500/10",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    purple: "bg-purple-50 text-brand-purple dark:bg-purple-500/10",
  };
  return (
    <div className={`rounded-xl p-3 text-center ${tones[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}
