"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, AlertCircle, FileCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SubmissionRow {
  id: string;
  studentName: string;
  rollNumber: string | null;
  assignmentTitle: string;
  courseTitle: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

const avatarPalette = [
  "bg-brand-blue",
  "bg-brand-green",
  "bg-brand-yellow",
  "bg-brand-purple",
  "bg-brand-red",
  "bg-indigo-500",
];

function getAvatarColor(name: string) {
  const sum = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return avatarPalette[sum % avatarPalette.length];
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function SubmissionsPage() {
  

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

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

      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .eq("faculty_id", user.id);

      const courseIds = (courses ?? []).map((c) => c.id);
      if (courseIds.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const courseTitleById = new Map((courses ?? []).map((c) => [c.id, c.title]));

      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, total_marks, course_id")
        .in("course_id", courseIds);

      const assignmentList = assignments ?? [];
      const assignmentIds = assignmentList.map((a) => a.id);
      const assignmentById = new Map(assignmentList.map((a) => [a.id, a]));

      if (assignmentIds.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const { data: submissionsData } = await supabase
        .from("submissions")
        .select("id, student_id, assignment_id, marks, status, submitted_at")
        .in("assignment_id", assignmentIds)
        .order("submitted_at", { ascending: false })
        .limit(20);

      const submissionRows = submissionsData ?? [];
      const studentIds = [...new Set(submissionRows.map((s) => s.student_id))];

      let profileRows: { id: string; full_name: string | null; email: string; roll_number: string | null }[] = [];
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, roll_number")
          .in("id", studentIds);
        profileRows = profilesData ?? [];
      }

      const rows: SubmissionRow[] = submissionRows.map((s) => {
        const studentRow = profileRows.find((u) => u.id === s.student_id);
        const assignment = assignmentById.get(s.assignment_id);
        const total = assignment?.total_marks ?? 0;
        const score =
          s.status === "graded" && s.marks !== null && total > 0
            ? Math.round((Number(s.marks) / total) * 100)
            : null;

        return {
          id: s.id,
          studentName: studentRow?.full_name || studentRow?.email || "Unknown Student",
          rollNumber: studentRow?.roll_number ?? null,
          assignmentTitle: assignment?.title ?? "Untitled Assignment",
          courseTitle: assignment ? courseTitleById.get(assignment.course_id) ?? "" : "",
          status: s.status,
          score,
          submittedAt: s.submitted_at,
        };
      });

      setSubmissions(rows);
      setLoading(false);
    };

    load();
  }, [supabase]);

  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Submissions</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Review and grade recent student submissions
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft dark:text-gray-400">Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-gray-400">No submissions yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-card transition-shadow hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt sm:p-5"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(
                  s.studentName
                )}`}
              >
                {getInitials(s.studentName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                  {s.studentName}
                  {s.rollNumber && (
                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-ink-faint dark:bg-white/5">
                      {s.rollNumber}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {s.assignmentTitle}
                  {s.courseTitle ? ` · ${s.courseTitle}` : ""} · {timeAgo(s.submittedAt)}
                </p>
              </div>

              {s.status === "graded" && (
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-brand-green dark:bg-green-500/10">
                  <CheckCircle2 size={13} /> Graded{s.score !== null ? ` · ${s.score}%` : ""}
                </span>
              )}
              {s.status === "pending" && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 dark:bg-amber-500/10">
                  <Clock size={13} /> Pending review
                </span>
              )}
              {s.status === "submitted" && (
                <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-brand-blue dark:bg-blue-500/10">
                  <FileCheck size={13} /> Submitted
                </span>
              )}
              {s.status === "late" && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-brand-red dark:bg-red-500/10">
                  <AlertCircle size={13} /> Late
                </span>
              )}

              <button
  onClick={() => (window.location.href = `/dashboard/submissions/${s.id}`)}
  className="rounded-full border border-black/10 px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-alt dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
>
  Review
</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}