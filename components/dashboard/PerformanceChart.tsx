"use client";

import "@/lib/chartSetup";
import { Line } from "react-chartjs-2";
import { useMemo, useState } from "react";

const RANGES = ["Weekly", "Monthly", "Semester"] as const;

const dataByRange: Record<(typeof RANGES)[number], number[]> = {
  Weekly: [72, 75, 74, 78, 81, 79, 83],
  Monthly: [68, 71, 74, 77, 76, 80, 82, 85, 83, 86, 88, 87],
  Semester: [65, 70, 74, 79, 84, 88],
};

const labelsByRange: Record<(typeof RANGES)[number], string[]> = {
  Weekly: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  Monthly: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  Semester: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5", "Final"],
};

export default function PerformanceChart() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("Monthly");

  const data = useMemo(
    () => ({
      labels: labelsByRange[range],
      datasets: [
        {
          label: "Average Score",
          data: dataByRange[range],
          borderColor: "#1a73e8",
          backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
            g.addColorStop(0, "rgba(26,115,232,0.28)");
            g.addColorStop(1, "rgba(26,115,232,0.0)");
            return g;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#1a73e8",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
        {
          label: "Submission Rate",
          data: dataByRange[range].map((v) => Math.min(100, v + 8)),
          borderColor: "#1e8e3e",
          backgroundColor: "transparent",
          fill: false,
          tension: 0.4,
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }),
    [range]
  );

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "top" as const,
        align: "end" as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { family: "Inter", size: 12 },
          color: "#5f6368",
        },
      },
      tooltip: {
        backgroundColor: "#1f2430",
        titleFont: { family: "Inter", weight: 600 as const },
        bodyFont: { family: "Inter" },
        padding: 10,
        cornerRadius: 10,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9aa0a6", font: { family: "Inter", size: 11 } },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: { color: "#9aa0a6", font: { family: "Inter", size: 11 }, stepSize: 20 },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Performance Overview
          </h3>
          <p className="text-xs text-ink-faint">
            Average score vs. submission rate across all classes
          </p>
        </div>
        <div className="flex rounded-full bg-surface-alt p-1 dark:bg-white/5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                range === r
                  ? "bg-white text-brand-blueDark shadow-soft dark:bg-surface-dark dark:text-blue-300"
                  : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[280px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
