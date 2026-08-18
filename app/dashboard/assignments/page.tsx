"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, HelpCircle, BookOpen, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ClassworkType = "assignment" | "quiz" | "material";
type ClassworkStatus = "draft" | "published";

interface AssignmentRow {
  id: string;
  course_id: string;
  courseTitle: string;
  title: string;
  type: ClassworkType;
  dueDate: string | null;
  status: ClassworkStatus;
  totalMarks: number | null;
  enrolled: number;
  submitted: number;
  graded: number;
  gradedMarks: number[];
}

const typeConfig: Record<ClassworkType, { icon: typeof ClipboardList; color: string; bg: string }> = {
  assignment: { icon: ClipboardList, color: "text-brand-blue", bg: "bg-blue-50 dark:bg-blue-500/10" },
  quiz: { icon: HelpCircle, color: "text-brand-purple", bg: "bg-purple-50 dark:bg-purple-500/10" },
  material: { icon: BookOpen, color: "text-brand-green", bg: "bg-green-50 dark:bg-green-500/10" },
};

const statusStyles: Record<ClassworkStatus, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  published: "bg-green-50 text-brand-green dark:bg-green-500/10",
};

export default function AssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [classCount, setClassCount] = useState(0);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: courseRows } = await supabase
        .from("courses")
        .select("id, title")
        .eq("faculty_id", user.id);

      const courseList = courseRows ?? [];
      const courseIds = courseList.map((c) => c.id);
      const courseTitleById = new Map(courseList.map((c) => [c.id, c.title]));
      setClassCount(courseList.length);
      setCourses(courseList);

      if (courseIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: items } = await supabase
        .from("assignments")
        .select("id, course_id, title, type, due_date, status, total_marks")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false });

      const itemList = items ?? [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, course_id")
        .in("course_id", courseIds);

      const enrolledCountByCourse = new Map<string, number>();
      (enrollments ?? []).forEach((e) => {
        enrolledCountByCourse.set(e.course_id, (enrolledCountByCourse.get(e.course_id) ?? 0) + 1);
      });

      const assignmentIds = itemList.filter((i) => i.type !== "material").map((i) => i.id);
      const submittedByAssignment = new Map<string, number>();
      const gradedByAssignment = new Map<string, number>();
      const gradedMarksByAssignment = new Map<string, number[]>();

      if (assignmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from("submissions")
          .select("assignment_id, status, marks")
          .in("assignment_id", assignmentIds)
          .neq("status", "pending");

        (submissions ?? []).forEach((s) => {
          submittedByAssignment.set(s.assignment_id, (submittedByAssignment.get(s.assignment_id) ?? 0) + 1);
          // Official grade — status "graded" with a real marks value only.
          // Never counts an automatic suggestion as a grade.
          if (s.status === "graded" && s.marks !== null) {
            gradedByAssignment.set(s.assignment_id, (gradedByAssignment.get(s.assignment_id) ?? 0) + 1);
            const list = gradedMarksByAssignment.get(s.assignment_id) ?? [];
            list.push(s.marks);
            gradedMarksByAssignment.set(s.assignment_id, list);
          }
        });
      }

      const mapped: AssignmentRow[] = itemList.map((item) => ({
        id: item.id,
        course_id: item.course_id,
        courseTitle: courseTitleById.get(item.course_id) ?? "—",
        title: item.title,
        type: item.type,
        dueDate: item.due_date,
        status: item.status,
        totalMarks: item.total_marks,
        enrolled: enrolledCountByCourse.get(item.course_id) ?? 0,
        submitted: submittedByAssignment.get(item.id) ?? 0,
        graded: gradedByAssignment.get(item.id) ?? 0,
        gradedMarks: gradedMarksByAssignment.get(item.id) ?? [],
      }));

      setRows(mapped);
      setLoading(false);
    };

    load();
  }, []);

  const formattedRows = useMemo(
    () =>
      rows
        .filter((r) => classFilter === "all" || r.course_id === classFilter)
        .filter((r) => !search.trim() || r.title.toLowerCase().includes(search.trim().toLowerCase()))
        .map((r) => {
          const average =
            r.gradedMarks.length > 0
              ? r.gradedMarks.reduce((a, b) => a + b, 0) / r.gradedMarks.length
              : null;
          return {
            ...r,
            dueLabel: r.dueDate
              ? new Date(r.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
              : "—",
            pendingReview: Math.max(0, r.submitted - r.graded),
            average,
          };
        }),
    [rows, classFilter, search]
  );

  return (
    <div className="animate-fadeInUp space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-white">Assignments</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
            Across {classCount} {classCount === 1 ? "class" : "classes"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assignments..."
              className="rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt"
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-ink-soft outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt dark:text-gray-300"
          >
            <option value="all">All classes</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-soft dark:text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading assignments…
        </div>
      ) : formattedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white py-16 text-center dark:border-white/10 dark:bg-surface-darkAlt">
          <p className="text-sm text-ink-faint">
            {rows.length === 0
              ? "No assignments, quizzes, or materials yet. Create one from a class's Classwork tab."
              : "No assignments match your search/filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-alt/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint dark:border-white/10 dark:bg-white/5">
                  <th className="px-4 py-3">Assignment</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-center">Submissions</th>
                  <th className="px-4 py-3 text-center">Graded</th>
                  <th className="px-4 py-3 text-center">Pending Review</th>
                  <th className="px-4 py-3 text-center">Average</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {formattedRows.map((a) => {
                  const cfg = typeConfig[a.type];
                  const Icon = cfg.icon;
                  const isMaterial = a.type === "material";
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-surface-alt/60 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/classes/${a.course_id}/assignment/${a.id}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
                            <Icon size={15} />
                          </div>
                          <span className="font-medium text-ink dark:text-white">{a.title}</span>
                          {a.status === "draft" && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles.draft}`}>
                              Draft
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft dark:text-gray-400">{a.courseTitle}</td>
                      <td className="px-4 py-3 text-ink-soft dark:text-gray-400">{a.dueLabel}</td>
                      <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                        {isMaterial ? "—" : `${a.submitted}/${a.enrolled}`}
                      </td>
                      <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                        {isMaterial ? "—" : `${a.graded}/${a.submitted}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isMaterial ? (
                          "—"
                        ) : a.pendingReview > 0 ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">{a.pendingReview}</span>
                        ) : (
                          <span className="text-ink-soft dark:text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                        {isMaterial ? "—" : a.average !== null ? `${a.average.toFixed(1)}${a.totalMarks !== null ? `/${a.totalMarks}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isMaterial && (
                          <Link
                            href={`/dashboard/classes/${a.course_id}/assignment/${a.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                          >
                            View Submissions
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
