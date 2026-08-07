"use client";

import { ClassItem } from "@/lib/types";
import { Users, Calendar, MapPin, Settings, Copy } from "lucide-react";

export const CLASS_TABS = [
  "Stream",
  "Classwork",
  "People",
  "Marks",
  "AI Insights",
] as const;

export type ClassTab = (typeof CLASS_TABS)[number];

export default function ClassHeader({
  item,
  activeTab,
  setActiveTab,
}: {
  item: ClassItem;
  activeTab: ClassTab;
  setActiveTab: (t: ClassTab) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
      {/* Banner */}
      <div
        className={`relative h-44 overflow-hidden bg-gradient-to-br ${item.banner} px-6 py-6 sm:h-52`}
      >
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-black/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {item.code}
            </span>
            <button className="rounded-full p-2 text-white/90 transition-colors hover:bg-white/20">
              <Settings size={18} />
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
              {item.name}
            </h1>
            <p className="mt-1 text-sm text-white/85">
              {item.department} · {item.semester}
            </p>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-black/5 px-6 py-3 text-xs text-ink-soft dark:border-white/5 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <Users size={14} /> {item.studentCount} students
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar size={14} /> {item.schedule}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={14} /> {item.room}
        </span>
        <button className="ml-auto flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1.5 font-medium text-ink-soft transition-colors hover:bg-blue-50 hover:text-brand-blue dark:bg-white/5 dark:text-gray-300">
          <Copy size={13} /> Class code
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none px-4">
        {CLASS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors duration-200 ${
              activeTab === tab
                ? "text-brand-blueDark dark:text-blue-300"
                : "text-ink-faint hover:text-ink-soft dark:hover:text-gray-300"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-brand-blue" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
