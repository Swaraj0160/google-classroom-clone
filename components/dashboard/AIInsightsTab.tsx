"use client";

import { useEffect, useMemo, useState } from "react";
import "@/lib/chartSetup";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  Gauge,
  Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

interface GradedRow {
  student_id: string;
  student_name: string | null;
  student_email: string;
  marks: number;
  total_marks: number;
  assignment_id: string;
  assignment_title: string;
  topic_id: string | null;
  topic_title: string | null;
}

function getInitials(name: string | null | undefined, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: "y" as const,
  plugins: { legend: { display: false } },
  scales: {
    x: { min: 0, max: 100, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#9aa0a6" } },
    y: { grid: { display: false }, ticks: { color: "#5f6368", font: { size: 11 } } },
  },
};

export default function AIInsightsTab() {
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graded, setGraded] = useState<GradedRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!profile?.id) return;
      setLoading(true);
      setError(null);

      const { data: courses, error: coursesError } = await supabase
        .from("courses")
        .select("id")
        .eq("faculty_id", profile.id);

      if (cancelled) return;
      if (coursesError) {
        setError(coursesError.message);
        setLoading(false);
        return;
      }

      const courseIds = (courses ?? []).map((c) => c.id);
      if (courseIds.length === 0) {
        setGraded([]);
        setLoading(false);
        return;
      }

      const { data: topics } = await supabase
        .from("topics")
        .select("id, title")
        .in("course_id", courseIds);
      const topicTitleMap = new Map((topics ?? []).map((t) => [t.id, t.title]));

      const { data: assignmentRows, error: assignmentsError } = await supabase
        .from("assignments")
        .select("id, title, total_marks, topic_id")
        .in("course_id", courseIds);

      if (cancelled) return;
      if (assignmentsError) {
        setError(assignmentsError.message);
        setLoading(false);
        return;
      }

      const assignmentList = assignmentRows ?? [];
      const assignmentIds = assignmentList.map((a) => a.id);
      const assignmentInfo = new Map(
        assignmentList.map((a) => [
          a.id,
          { title: a.title, total_marks: a.total_marks, topic_id: a.topic_id },
        ])
      );

      if (assignmentIds.length === 0) {
        setGraded([]);
        setLoading(false);
        return;
      }

      const { data: submissionRows, error: submissionsError } = await supabase
        .from("submissions")
        .select(
          "student_id, marks, assignment_id, student:users!student_id ( full_name, email )"
        )
        .in("assignment_id", assignmentIds)
        .eq("status", "graded");

      if (cancelled) return;
      if (submissionsError) {
        setError(submissionsError.message);
        setLoading(false);
        return;
      }

      const rows: GradedRow[] = (submissionRows ?? [])
        .map((s: any) => {
          const info = assignmentInfo.get(s.assignment_id);
          if (!info || !info.total_marks || s.marks === null) return null;
          return {
            student_id: s.student_id,
            student_name: s.student?.full_name ?? null,
            student_email: s.student?.email ?? "",
            marks: s.marks,
            total_marks: info.total_marks,
            assignment_id: s.assignment_id,
            assignment_title: info.title,
            topic_id: info.topic_id,
            topic_title: info.topic_id ? topicTitleMap.get(info.topic_id) ?? null : null,
          };
        })
        .filter((r): r is GradedRow => r !== null);

      setGraded(rows);
      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const classAveragePct = useMemo(() => {
    if (graded.length === 0) return null;
    const total = graded.reduce((sum, r) => sum + (r.marks / r.total_marks) * 100, 0);
    return Math.round(total / graded.length);
  }, [graded]);

  const topPerformer = useMemo(() => {
    if (graded.length === 0) return null;

    const byStudent = new Map<string, { name: string | null; email: string; total: number; count: number }>();
    graded.forEach((r) => {
      const entry = byStudent.get(r.student_id) ?? {
        name: r.student_name,
        email: r.student_email,
        total: 0,
        count: 0,
      };
      entry.total += (r.marks / r.total_marks) * 100;
      entry.count += 1;
      byStudent.set(r.student_id, entry);
    });

    const averages: { name: string | null; email: string; avg: number }[] = Array.from(
      byStudent.values()
    ).map((v) => ({
      name: v.name,
      email: v.email,
      avg: Math.round(v.total / v.count),
    }));

    if (averages.length === 0) return null;

    return averages.reduce(
      (best, current) => (current.avg > best.avg ? current : best),
      averages[0]
    );
  }, [graded]);

  const weakTopics = useMemo(() => {
    const byTopic = new Map<string, { title: string; total: number; count: number }>();
    graded
      .filter((r) => r.topic_id)
      .forEach((r) => {
        const key = r.topic_id as string;
        const entry = byTopic.get(key) ?? { title: r.topic_title ?? "Untitled topic", total: 0, count: 0 };
        entry.total += (r.marks / r.total_marks) * 100;
        entry.count += 1;
        byTopic.set(key, entry);
      });
    return Array.from(byTopic.values())
      .map((t) => ({ topic: t.title, mastery: Math.round(t.total / t.count) }))
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 5);
  }, [graded]);

  const assignmentDifficulty = useMemo(() => {
    const byAssignment = new Map<string, { title: string; total: number; count: number }>();
    graded.forEach((r) => {
      const entry = byAssignment.get(r.assignment_id) ?? {
        title: r.assignment_title,
        total: 0,
        count: 0,
      };
      entry.total += (r.marks / r.total_marks) * 100;
      entry.count += 1;
      byAssignment.set(r.assignment_id, entry);
    });
    return Array.from(byAssignment.values())
      .map((a) => ({ name: a.title, difficulty: Math.max(0, 100 - Math.round(a.total / a.count)) }))
      .sort((a, b) => b.difficulty - a.difficulty)
      .slice(0, 6);
  }, [graded]);

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

  if (graded.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white py-20 text-center dark:border-white/10 dark:bg-surface-darkAlt">
        <Sparkles size={28} className="mb-3 text-ink-faint" />
        <p className="text-sm font-medium text-ink-faint">
          AI Insights will be available after sufficient assignment and submission data is collected.
        </p>
      </div>
    );
  }

  const doughnutData = {
    labels: ["Class Average", "Remaining"],
    datasets: [
      {
        data: [classAveragePct ?? 0, 100 - (classAveragePct ?? 0)],
        backgroundColor: ["#1a73e8", "#e8eaed"],
        borderWidth: 0,
        cutout: "75%",
      },
    ],
  };

  const weakTopicsData = {
    labels: weakTopics.map((t) => t.topic),
    datasets: [
      {
        label: "Avg score %",
        data: weakTopics.map((t) => t.mastery),
        backgroundColor: weakTopics.map((t) =>
          t.mastery < 50 ? "#d93025" : t.mastery < 65 ? "#f9ab00" : "#1a73e8"
        ),
        borderRadius: 8,
        barThickness: 22,
      },
    ],
  };

  const difficultyData = {
    labels: assignmentDifficulty.map((a) => a.name),
    datasets: [
      {
        label: "Difficulty Index",
        data: assignmentDifficulty.map((a) => a.difficulty),
        backgroundColor: "rgba(132,48,206,0.7)",
        borderRadius: 8,
        barThickness: 22,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* AI banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-glow">
        <div className="absolute -right-10 -top-10 h-48 w-48 animate-pulseSoft rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Insights</h2>
            <p className="text-sm text-white/85">
              Computed from graded assignment submissions across your classes
            </p>
          </div>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Class average */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-2 flex items-center gap-2">
            <Gauge size={16} className="text-brand-blue" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Class Average
            </h3>
          </div>
          <div className="relative mx-auto h-40 w-40">
            <Doughnut
              data={doughnutData}
              options={{
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                maintainAspectRatio: false,
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-ink dark:text-white">{classAveragePct}%</span>
              <span className="text-[10px] text-ink-faint">across graded work</span>
            </div>
          </div>
        </div>

        {/* Top performer */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-brand-yellow" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Top Performer
            </h3>
          </div>
          {topPerformer && (
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-blue/10 text-lg font-semibold text-brand-blue ring-4 ring-yellow-100 dark:ring-yellow-500/20">
                {getInitials(topPerformer.name, topPerformer.email)}
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-amber-600 text-white shadow-soft">
                  <Trophy size={13} />
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink dark:text-white">
                {topPerformer.name || topPerformer.email}
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-green">{topPerformer.avg}%</p>
            </div>
          )}
        </div>

        {/* No attendance/participation data available */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-4 flex items-center gap-2">
            <Info size={16} className="text-ink-faint" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Student Risk Analysis
            </h3>
          </div>
          <p className="text-xs text-ink-faint">
            Not available yet — this requires attendance or participation data, which isn&apos;t tracked in the current system.
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={16} className="text-brand-red" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Weak Topics
            </h3>
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            Lowest average score by topic, based on graded submissions
          </p>
          {weakTopics.length > 0 ? (
            <div className="h-[220px]">
              <Bar data={weakTopicsData} options={barOptions} />
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-ink-faint">
              No topic-tagged graded assignments yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-1 flex items-center gap-2">
            <Gauge size={16} className="text-brand-purple" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Assignment Difficulty
            </h3>
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            Derived from average score per assignment (lower average = higher difficulty)
          </p>
          {assignmentDifficulty.length > 0 ? (
            <div className="h-[220px]">
              <Bar data={difficultyData} options={barOptions} />
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-ink-faint">No graded assignments yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}