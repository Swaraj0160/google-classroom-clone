"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, HelpCircle, BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ClassworkType = "assignment" | "quiz" | "material";
type ClassworkStatus = "draft" | "published";

interface AssignmentRow {
  id: string;
  course_id: string;
  courseTitle: string;
  courseLinkId: string;
  title: string;
  type: ClassworkType;
  dueDate: string | null;
  status: ClassworkStatus;
  submitted: number;
  total: number;
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
  const [rows, setRows] = useState<AssignmentRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .eq("faculty_id", user.id);

      const courseList = courses ?? [];
      const courseIds = courseList.map((c) => c.id);
      const courseTitleById = new Map(courseList.map((c) => [c.id, c.title]));
      setClassCount(courseList.length);

      if (courseIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: items } = await supabase
        .from("assignments")
        .select("id, course_id, title, type, due_date, status")
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
      const submittedCountByAssignment = new Map<string, number>();

      if (assignmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from("submissions")
          .select("assignment_id, status")
          .in("assignment_id", assignmentIds)
          .neq("status", "pending");

        (submissions ?? []).forEach((s) => {
          submittedCountByAssignment.set(
            s.assignment_id,
            (submittedCountByAssignment.get(s.assignment_id) ?? 0) + 1
          );
        });
      }

      const mapped: AssignmentRow[] = itemList.map((item) => ({
        id: item.id,
        course_id: item.course_id,
        courseTitle: courseTitleById.get(item.course_id) ?? "—",
        courseLinkId: item.course_id,
        title: item.title,
        type: item.type,
        dueDate: item.due_date,
        status: item.status,
        submitted: submittedCountByAssignment.get(item.id) ?? 0,
        total: enrolledCountByCourse.get(item.course_id) ?? 0,
      }));

      setRows(mapped);
      setLoading(false);
    };

    load();
  }, []);

  const formattedRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        dueLabel: r.dueDate
          ? new Date(r.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
          : "—",
      })),
    [rows]
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-soft dark:text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading assignments…
        </div>
      ) : formattedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white py-16 text-center dark:border-white/10 dark:bg-surface-darkAlt">
          <p className="text-sm text-ink-faint">
            No assignments, quizzes, or materials yet. Create one from a class&apos;s Classwork tab.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-alt/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint dark:border-white/10 dark:bg-white/5">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Submissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {formattedRows.map((a) => {
                  const cfg = typeConfig[a.type];
                  const Icon = cfg.icon;
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-surface-alt/60 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/classes/${a.courseLinkId}/assignment/${a.id}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
                            <Icon size={15} />
                          </div>
                          <span className="font-medium text-ink dark:text-white">{a.title}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft dark:text-gray-400">{a.courseTitle}</td>
                      <td className="px-4 py-3 capitalize text-ink-soft dark:text-gray-400">{a.type}</td>
                      <td className="px-4 py-3 text-ink-soft dark:text-gray-400">{a.dueLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusStyles[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                        {a.type === "material" ? "—" : `${a.submitted}/${a.total}`}
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
