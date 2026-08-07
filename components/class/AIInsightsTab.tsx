"use client";

import "@/lib/chartSetup";
import { Bar, Doughnut, Radar } from "react-chartjs-2";
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  CalendarCheck,
  Gauge,
  ShieldAlert,
} from "lucide-react";
import { assignmentDifficulty, students, weakTopics } from "@/lib/data";
import Image from "next/image";

const topPerformer = [...students].sort((a, b) => b.average - a.average)[0];
const atRisk = students.filter((s) => s.risk !== "low");

export default function AIInsightsTab() {
  const doughnutData = {
    labels: ["Class Average", "Remaining"],
    datasets: [
      {
        data: [82, 18],
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
        label: "Mastery %",
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
        backgroundColor: "rgba(132,48,206,0.18)",
        borderColor: "#8430ce",
        borderWidth: 2,
        pointBackgroundColor: "#8430ce",
        pointRadius: 4,
      },
    ],
  };

  const attendancePrediction = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5 (predicted)"],
    datasets: [
      {
        label: "Attendance %",
        data: [91, 88, 85, 82, 79],
        backgroundColor: [
          "#1a73e8",
          "#1a73e8",
          "#1a73e8",
          "#1a73e8",
          "rgba(217,48,37,0.7)",
        ],
        borderRadius: 8,
        barThickness: 26,
      },
    ],
  };

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

  const attendanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#9aa0a6", font: { size: 10 } } },
      y: { min: 60, max: 100, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#9aa0a6" } },
    },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        min: 0,
        max: 100,
        grid: { color: "rgba(0,0,0,0.06)" },
        angleLines: { color: "rgba(0,0,0,0.06)" },
        pointLabels: { color: "#5f6368", font: { size: 10 } },
        ticks: { display: false },
      },
    },
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
              Generated from submission patterns, grading history, and attendance data
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
            <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-ink dark:text-white">82%</span>
              <span className="text-[10px] text-ink-faint">+6.8% this term</span>
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
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Image
                src={topPerformer.avatar}
                alt={topPerformer.name}
                width={72}
                height={72}
                className="rounded-full ring-4 ring-yellow-100 dark:ring-yellow-500/20"
              />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-amber-600 text-white shadow-soft">
                <Trophy size={13} />
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink dark:text-white">
              {topPerformer.name}
            </p>
            <p className="text-xs text-ink-faint">{topPerformer.rollNumber}</p>
            <p className="mt-2 text-2xl font-bold text-brand-green">
              {topPerformer.average}%
            </p>
          </div>
        </div>

        {/* Student risk analysis */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className="text-brand-red" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Student Risk Analysis
            </h3>
          </div>
          <div className="space-y-2.5">
            {atRisk.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <Image
                  src={s.avatar}
                  alt={s.name}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink dark:text-white">
                    {s.name}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                    s.risk === "high"
                      ? "bg-red-50 text-brand-red dark:bg-red-500/10"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
                  }`}
                >
                  {s.risk} risk
                </span>
              </div>
            ))}
          </div>
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
            Topic mastery based on quiz &amp; assignment performance
          </p>
          <div className="h-[220px]">
            <Bar data={weakTopicsData} options={barOptions} />
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <div className="mb-1 flex items-center gap-2">
            <CalendarCheck size={16} className="text-brand-blue" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Attendance Prediction
            </h3>
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            Trend-based forecast for next week&apos;s attendance
          </p>
          <div className="h-[220px]">
            <Bar data={attendancePrediction} options={attendanceOptions} />
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt lg:col-span-2">
          <div className="mb-1 flex items-center gap-2">
            <Gauge size={16} className="text-brand-purple" />
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Assignment Difficulty
            </h3>
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            AI-estimated difficulty index derived from time-on-task and error rates
          </p>
          <div className="mx-auto h-[280px] max-w-lg">
            <Radar data={difficultyData} options={radarOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
