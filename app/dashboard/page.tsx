"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardList, AlertTriangle, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UpcomingAssignments } from "@/components/UpcomingAssignments";

interface Stats {
  classes: number;
  activeAssignments: number;
  pendingReviews: number;
  students: number;
}

interface PendingReviewRow {
  assignmentId: string;
  courseId: string;
  title: string;
  courseTitle: string;
  waiting: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    classes: 0,
    activeAssignments: 0,
    pendingReviews: 0,
    students: 0,
  });
  const [pendingRows, setPendingRows] = useState<PendingReviewRow[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

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

    if (courseIds.length === 0) {
      setStats({ classes: 0, activeAssignments: 0, pendingReviews: 0, students: 0 });
      setPendingRows([]);
      setLoading(false);
      return;
    }

    // Assignments and enrollments both only depend on courseIds — fetch concurrently.
    const [{ data: assignments }, { data: enrollments }] = await Promise.all([
      supabase
        .from("assignments")
        .select("id, course_id, title, status, type")
        .in("course_id", courseIds)
        .in("type", ["assignment", "quiz"]),
      supabase.from("enrollments").select("student_id").in("course_id", courseIds),
    ]);

    const assignmentList = assignments ?? [];
    const assignmentIds = assignmentList.map((a) => a.id);
    const distinctStudents = new Set((enrollments ?? []).map((e) => e.student_id));
    const activeAssignments = assignmentList.filter((a) => a.status === "published").length;

    let pendingReviews = 0;
    const pendingByAssignment = new Map<string, number>();

    if (assignmentIds.length > 0) {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("assignment_id, status, submitted_at")
        .in("assignment_id", assignmentIds)
        .neq("status", "pending");

      (submissions ?? []).forEach((s) => {
        if (s.status === "graded") return;
        pendingReviews++;
        pendingByAssignment.set(s.assignment_id, (pendingByAssignment.get(s.assignment_id) ?? 0) + 1);
      });
    }

    const pending: PendingReviewRow[] = assignmentList
      .filter((a) => pendingByAssignment.has(a.id))
      .map((a) => ({
        assignmentId: a.id,
        courseId: a.course_id,
        title: a.title,
        courseTitle: courseTitleById.get(a.course_id) ?? "—",
        waiting: pendingByAssignment.get(a.id) ?? 0,
      }))
      .sort((a, b) => b.waiting - a.waiting)
      .slice(0, 6);

    setStats({
      classes: courseList.length,
      activeAssignments,
      pendingReviews,
      students: distinctStudents.size,
    });
    setPendingRows(pending);
    setLoading(false);
  }

  const tiles = [
    { label: "My Classes", value: stats.classes, icon: BookOpen, tone: "blue" as const },
    { label: "Active Assignments", value: stats.activeAssignments, icon: ClipboardList, tone: "purple" as const },
    { label: "Pending Reviews", value: stats.pendingReviews, icon: AlertTriangle, tone: "amber" as const },
    { label: "Students", value: stats.students, icon: Users, tone: "green" as const },
  ];

  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-brand-blue dark:bg-blue-500/10",
    purple: "bg-purple-50 text-brand-purple dark:bg-purple-500/10",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
    green: "bg-green-50 text-brand-green dark:bg-green-500/10",
  };

  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Welcome back — here&apos;s what needs your attention today.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt"
            >
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[t.tone]}`}>
                <Icon size={17} />
              </div>
              <p className="text-2xl font-bold text-ink dark:text-white">{loading ? "—" : t.value}</p>
              <p className="mt-0.5 text-xs font-medium text-ink-faint">{t.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Pending Reviews
          </h2>
          {loading ? (
            <p className="text-sm text-ink-faint">Loading…</p>
          ) : pendingRows.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing waiting for review right now.</p>
          ) : (
            <div className="space-y-2">
              {pendingRows.map((row) => (
                <Link
                  key={row.assignmentId}
                  href={`/dashboard/classes/${row.courseId}/assignment/${row.assignmentId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 transition-colors hover:bg-surface-alt dark:border-white/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink dark:text-white">{row.title}</p>
                    <p className="truncate text-xs text-ink-faint">{row.courseTitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      {row.waiting} waiting
                    </span>
                    <ChevronRight size={16} className="text-ink-faint" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <UpcomingAssignments />
      </div>
    </div>
  );
}
