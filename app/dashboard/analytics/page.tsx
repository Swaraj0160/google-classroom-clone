"use client";

import { useEffect, useState } from "react";
import "@/lib/chartSetup";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import StatCard from "@/components/dashboard/StatCard";
import { BarChart3, Users, ClipboardCheck, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SubmissionRow {
  id: string;
  student_id: string;
  assignment_id: string;
  marks: number | null;
  status: string;
  submitted_at: string | null;
}

interface AssignmentRow {
  id: string;
  course_id: string;
  total_marks: number | null;
}

interface CourseRow {
  id: string;
  title: string;
}

export default function AnalyticsPage() {
 

  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [gradingCompletedPct, setGradingCompletedPct] = useState(0);
  const [avgClassScore, setAvgClassScore] = useState(0);
  const [engagementPct, setEngagementPct] = useState(0);
  const [scoreTrend, setScoreTrend] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Avg Score",
        data: [] as number[],
        borderColor: "#1a73e8",
        backgroundColor: "rgba(26,115,232,0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  });
  const [classComparison, setClassComparison] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Average Score",
        data: [] as number[],
        backgroundColor: "#1a73e8",
        borderRadius: 8,
      },
    ],
  });
  const [distribution, setDistribution] = useState({
    labels: ["A grade", "B grade", "C grade", "D grade", "F grade"],
    datasets: [
      {
        data: [0, 0, 0, 0, 0] as number[],
        backgroundColor: ["#1e8e3e", "#1a73e8", "#f9ab00", "#ff7043", "#d93025"],
        borderWidth: 0,
      },
    ],
  });

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

      const courseList = (courses ?? []) as CourseRow[];
      const courseIds = courseList.map((c) => c.id);
      if (courseIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, course_id")
        .in("course_id", courseIds);

      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, course_id, total_marks")
        .in("course_id", courseIds);

      const assignmentList = (assignments ?? []) as AssignmentRow[];
      const assignmentIds = assignmentList.map((a) => a.id);

      let submissions: SubmissionRow[] = [];
      if (assignmentIds.length > 0) {
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("id, student_id, assignment_id, marks, status, submitted_at")
          .in("assignment_id", assignmentIds);
        submissions = (submissionsData ?? []) as SubmissionRow[];
      }

      // Total Students: distinct students enrolled across this faculty's courses.
      const enrolledStudentIds = new Set((enrollments ?? []).map((e) => e.student_id));
      setTotalStudents(enrolledStudentIds.size);

      // Grading Completed %: proportion of submissions with status = 'graded'.
      const gradingPct = submissions.length
        ? (submissions.filter((s) => s.status === "graded").length / submissions.length) * 100
        : 0;
      setGradingCompletedPct(Math.round(gradingPct));

      // Overall Engagement %: enrolled students with at least one submission / total enrolled students.
      const submittedStudentIds = new Set(submissions.map((s) => s.student_id));
      const engagedCount = [...enrolledStudentIds].filter((id) => submittedStudentIds.has(id)).length;
      const engagement = enrolledStudentIds.size ? (engagedCount / enrolledStudentIds.size) * 100 : 0;
      setEngagementPct(Math.round(engagement));

      // Score-based metrics only use graded submissions that have marks recorded.
      const assignmentById = new Map(assignmentList.map((a) => [a.id, a]));
      const courseById = new Map(courseList.map((c) => [c.id, c.title]));

      const gradedScored = submissions
        .filter((s) => s.status === "graded" && s.marks !== null)
        .map((s) => {
          const assignment = assignmentById.get(s.assignment_id);
          const total = assignment?.total_marks ?? 0;
          const courseTitle = assignment ? courseById.get(assignment.course_id) : undefined;
          const percent = total > 0 ? (Number(s.marks) / total) * 100 : 0;
          return { ...s, percent, courseTitle, courseId: assignment?.course_id };
        });

      // Avg Class Score: average percent across all graded, scored submissions.
      const avgScore = gradedScored.length
        ? gradedScored.reduce((sum, s) => sum + s.percent, 0) / gradedScored.length
        : 0;
      setAvgClassScore(Math.round(avgScore));

      // Score Trend: average percent per week, grouped over the last 8 weeks up to today.
      const now = new Date();
      const weekBuckets: number[] = new Array(8).fill(0);
      const weekCounts: number[] = new Array(8).fill(0);
      gradedScored.forEach((s) => {
        if (!s.submitted_at) return;
        const submittedDate = new Date(s.submitted_at);
        const diffMs = now.getTime() - submittedDate.getTime();
        const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        const bucketIndex = 7 - diffWeeks; // oldest -> W1, most recent -> W8
        if (bucketIndex >= 0 && bucketIndex < 8) {
          weekBuckets[bucketIndex] += s.percent;
          weekCounts[bucketIndex] += 1;
        }
      });
      const trendData = weekBuckets.map((total, i) => (weekCounts[i] ? Math.round(total / weekCounts[i]) : 0));
      setScoreTrend({
        labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
        datasets: [
          {
            label: "Avg Score",
            data: trendData,
            borderColor: "#1a73e8",
            backgroundColor: "rgba(26,115,232,0.15)",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          },
        ],
      });

      // Class-wise Average Comparison: average percent per course, labeled by courses.title.
      const perCourseTotals = new Map<string, { sum: number; count: number }>();
      gradedScored.forEach((s) => {
        if (!s.courseId) return;
        const entry = perCourseTotals.get(s.courseId) ?? { sum: 0, count: 0 };
        entry.sum += s.percent;
        entry.count += 1;
        perCourseTotals.set(s.courseId, entry);
      });
      const comparisonLabels = courseList.map((c) => c.title);
      const comparisonData = courseList.map((c) => {
        const entry = perCourseTotals.get(c.id);
        return entry && entry.count ? Math.round(entry.sum / entry.count) : 0;
      });
      setClassComparison({
        labels: comparisonLabels,
        datasets: [
          {
            label: "Average Score",
            data: comparisonData,
            backgroundColor: "#1a73e8",
            borderRadius: 8,
          },
        ],
      });

      // Grade Distribution: bucket each graded, scored submission's percent into A–F.
      const buckets = [0, 0, 0, 0, 0]; // A, B, C, D, F
      gradedScored.forEach((s) => {
        if (s.percent >= 90) buckets[0]++;
        else if (s.percent >= 80) buckets[1]++;
        else if (s.percent >= 70) buckets[2]++;
        else if (s.percent >= 60) buckets[3]++;
        else buckets[4]++;
      });
      setDistribution({
        labels: ["A grade", "B grade", "C grade", "D grade", "F grade"],
        datasets: [
          {
            data: buckets,
            backgroundColor: ["#1e8e3e", "#1a73e8", "#f9ab00", "#ff7043", "#d93025"],
            borderWidth: 0,
          },
        ],
      });

      setLoading(false);
    };

    load();
  }, [supabase]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#9aa0a6" } },
      y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#9aa0a6" } },
    },
  };

  if (loading) {
    return (
      <div className="animate-fadeInUp space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
            Deep insights across every class you teach
          </p>
        </div>
        <p className="text-sm text-ink-soft dark:text-gray-400">Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Analytics</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Deep insights across every class you teach
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
  label="Overall Engagement"
  value={String(engagementPct)}
  suffix="%"
  icon={BarChart3}
  accent="from-brand-blue to-indigo-600"
/>

<StatCard
  label="Total Students"
  value={String(totalStudents)}
  icon={Users}
  accent="from-brand-green to-emerald-600"
/>

<StatCard
  label="Grading Completed"
  value={String(gradingCompletedPct)}
  suffix="%"
  icon={ClipboardCheck}
  accent="from-brand-yellow to-amber-600"
/>

<StatCard
  label="Avg Class Score"
  value={String(avgClassScore)}
  suffix="%"
  icon={Target}
  accent="from-brand-purple to-fuchsia-600"
/>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-ink dark:text-white">
            Score Trend — All Classes
          </h3>
          <div className="h-[260px]">
            <Line data={scoreTrend} options={commonOptions} />
          </div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <h3 className="mb-4 text-sm font-semibold text-ink dark:text-white">
            Grade Distribution
          </h3>
          <div className="h-[260px]">
            <Doughnut
              data={distribution}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { boxWidth: 8, font: { size: 11 }, color: "#5f6368" },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
        <h3 className="mb-4 text-sm font-semibold text-ink dark:text-white">
          Class-wise Average Comparison
        </h3>
        <div className="h-[280px]">
          <Bar data={classComparison} options={commonOptions} />
        </div>
      </div>
    </div>
  );
}