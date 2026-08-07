"use client";

import { assignments } from "@/lib/data";
import {
  ClipboardList,
  HelpCircle,
  BookOpen,
  Plus,
  MoreVertical,
} from "lucide-react";

const typeConfig = {
  assignment: { icon: ClipboardList, color: "text-brand-blue", bg: "bg-blue-50 dark:bg-blue-500/10" },
  quiz: { icon: HelpCircle, color: "text-brand-purple", bg: "bg-purple-50 dark:bg-purple-500/10" },
  material: { icon: BookOpen, color: "text-brand-green", bg: "bg-green-50 dark:bg-green-500/10" },
};

const statusStyles = {
  draft: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  published: "bg-green-50 text-brand-green dark:bg-green-500/10",
  closed: "bg-red-50 text-brand-red dark:bg-red-500/10",
};

export default function ClassworkTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink dark:text-white">
          Classwork
        </h2>
        <button className="flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:bg-brand-blueDark hover:shadow-elevated active:scale-95">
          <Plus size={16} /> Create Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assignments.map((a) => {
          const cfg = typeConfig[a.type];
          const Icon = cfg.icon;
          const pct = a.total ? Math.round((a.submitted / a.total) * 100) : 0;
          return (
            <div
              key={a.id}
              className="group rounded-2xl border border-black/5 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bg} ${cfg.color}`}>
                  <Icon size={19} />
                </div>
                <button className="rounded-full p-1 text-ink-faint transition-colors hover:bg-surface-alt dark:hover:bg-white/10">
                  <MoreVertical size={16} />
                </button>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-ink dark:text-white">
                {a.title}
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusStyles[a.status]}`}>
                  {a.status}
                </span>
                {a.points > 0 && (
                  <span className="text-[11px] text-ink-faint">{a.points} pts</span>
                )}
              </div>

              <p className="mt-3 text-xs text-ink-faint">Due {a.dueDate}</p>

              {a.type !== "material" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-ink-faint">
                    <span>Submissions</span>
                    <span>
                      {a.submitted}/{a.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-blue to-indigo-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
