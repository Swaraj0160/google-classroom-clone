"use client";

import { FilePlus2, FolderPlus, Sparkles, UploadCloud } from "lucide-react";

const actions = [
  {
    label: "Create Class",
    desc: "Set up a new course",
    icon: FolderPlus,
    accent: "from-brand-blue to-blue-600",
  },
  {
    label: "Create Assignment",
    desc: "Post new coursework",
    icon: FilePlus2,
    accent: "from-brand-green to-emerald-600",
  },
  {
    label: "Upload Marks",
    desc: "Import a marksheet",
    icon: UploadCloud,
    accent: "from-brand-yellow to-amber-600",
  },
  {
    label: "Generate AI Marks",
    desc: "Auto-grade submissions",
    icon: Sparkles,
    accent: "from-brand-purple to-fuchsia-600",
  },
];

export default function QuickActions() {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt sm:p-6">
      <h3 className="mb-5 text-base font-semibold text-ink dark:text-white">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              className="group flex flex-col items-start gap-3 rounded-xl border border-black/5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-elevated dark:border-white/10"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${a.accent} text-white shadow-soft transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink dark:text-white">
                  {a.label}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">{a.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
