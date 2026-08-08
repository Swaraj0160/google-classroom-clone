"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  ClipboardList,
  Award,
  TrendingUp,
  Clock,
  Target,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface GradeSubmission {
  id: string;
  marks: number | null;
  feedback: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;

  assignment: {
    id: string;
    title: string;
    total_marks: number | null;
    due_date: string | null;

    course: {
      title: string;
    } | null;
  } | null;
}

export default function StudentGradesPage() {
  const [loading, setLoading] = useState(true);
  const [allSubmissions, setAllSubmissions] = useState<GradeSubmission[]>([]);

  useEffect(() => {
    loadGrades();
  }, []);

  async function loadGrades() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("submissions")
      .select(`
        id,
        marks,
        feedback,
        status,
        submitted_at,
        updated_at,
        assignment:assignments(
          id,
          title,
          total_marks,
          due_date,
          course:courses(
            title
          )
        )
      `)
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setAllSubmissions([]);
    } else {
      setAllSubmissions((data as unknown as GradeSubmission[]) ?? []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const graded = allSubmissions.filter((s) => s.status === "graded" && s.marks !== null);

  const percentages = graded
    .map((s) => {
      const total = s.assignment?.total_marks;
      return total ? (Number(s.marks) / total) * 100 : null;
    })
    .filter((p): p is number => p !== null);

  const average = percentages.length
    ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
    : null;
  const highest = percentages.length ? Math.round(Math.max(...percentages)) : null;
  const completedCount = graded.length;
  const pendingCount = allSubmissions.filter((s) => s.status !== "graded").length;

  // Punctuality and trend are derived from real submission timestamps/scores only.
  const submittedWork = allSubmissions.filter((s) => s.submitted_at);
  const lateCount = submittedWork.filter(
    (s) => s.assignment?.due_date && new Date(s.submitted_at as string) > new Date(s.assignment.due_date)
  ).length;
  const onTimeRate = submittedWork.length
    ? Math.round(((submittedWork.length - lateCount) / submittedWork.length) * 100)
    : null;

  // `graded` is ordered most-recent-first (query order), so compare the newer
  // half of graded scores against the older half.
  let trend: "Improving" | "Declining" | "Steady" | null = null;
  if (percentages.length >= 4) {
    const half = Math.floor(percentages.length / 2);
    const recentAvg = percentages.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const olderAvg =
      percentages.slice(half).reduce((a, b) => a + b, 0) / (percentages.length - half);
    const diff = recentAvg - olderAvg;
    trend = diff > 3 ? "Improving" : diff < -3 ? "Declining" : "Steady";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Grades</h1>
        <p className="mt-2 text-gray-500">View your graded assignments.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Average</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{average !== null ? `${average}%` : "—"}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Target size={16} />
            <span className="text-xs font-medium">Highest</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{highest !== null ? `${highest}%` : "—"}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock size={16} />
            <span className="text-xs font-medium">Pending</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <CheckCircle2 size={16} />
            <span className="text-xs font-medium">Completed</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{completedCount}</p>
        </div>
      </div>

      {(onTimeRate !== null || trend) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-white px-5 py-3 text-sm text-gray-600 shadow-sm">
          {onTimeRate !== null && (
            <span>
              On-time submissions: <strong className="text-gray-900">{onTimeRate}%</strong>
            </span>
          )}
          {trend && (
            <span>
              Performance trend:{" "}
              <strong
                className={
                  trend === "Improving"
                    ? "text-green-600"
                    : trend === "Declining"
                    ? "text-red-600"
                    : "text-gray-900"
                }
              >
                {trend}
              </strong>
            </span>
          )}
        </div>
      )}

      {graded.length === 0 ? (
        <div className="rounded-2xl border bg-white py-24 text-center shadow-sm">
          <Award size={64} className="mx-auto mb-5 text-gray-300" />
          <h2 className="text-xl font-semibold">No Grades Yet</h2>
          <p className="mt-2 text-gray-500">Your graded assignments will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {graded.map((submission) => {
            const assignment = submission.assignment;
            const course = assignment?.course;
            const isLate =
              !!submission.submitted_at &&
              !!assignment?.due_date &&
              new Date(submission.submitted_at) > new Date(assignment.due_date);

            return (
              <div key={submission.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClipboardList size={18} className="text-blue-600" />
                      <h2 className="text-lg font-semibold">{assignment?.title ?? "Assignment"}</h2>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">{course?.title ?? "-"}</p>

                    {submission.submitted_at && (
                      <p className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        Submitted {new Date(submission.submitted_at).toLocaleString()}
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            isLate ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          }`}
                        >
                          {isLate ? "Late" : "On Time"}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 text-green-600">
                      <CheckCircle2 size={18} />
                      <span className="font-semibold">Graded</span>
                    </div>

                    <div className="mt-2 text-3xl font-bold">
                      {submission.marks ?? "-"}
                      {assignment?.total_marks != null && (
                        <span className="text-lg text-gray-500"> / {assignment.total_marks}</span>
                      )}
                    </div>
                  </div>
                </div>

                {submission.feedback && (
                  <div className="mt-6 rounded-xl bg-gray-50 p-4">
                    <h3 className="mb-2 font-semibold">Faculty Remarks</h3>
                    <p className="whitespace-pre-wrap text-gray-600">{submission.feedback}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}