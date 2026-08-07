"use client";

import Link from "next/link";
import { MoreVertical, Users, Folder, ClipboardList } from "lucide-react";

interface Course {
  id: string;
  title: string;
  subject: string;
  semester: number;
  division: string;
  join_code: string;
}

export default function ClassCard({ item }: { item: Course }) {
  return (
    <Link
      href={`/dashboard/classes/${item.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt"
    >
      {/* Banner */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 px-4 pb-3 pt-4">
        <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10" />

        <div className="relative flex items-start justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-[15px] font-semibold text-white">
              {item.title}
            </p>

            <p className="mt-0.5 text-xs text-white/80">
              {item.join_code}
            </p>
          </div>

          <button
            onClick={(e) => e.preventDefault()}
            className="rounded-full p-1 text-white hover:bg-white/20"
          >
            <MoreVertical size={17} />
          </button>
        </div>

        <p className="mt-6 text-xs font-medium text-white/85">
          {item.subject}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium">
            Semester {item.semester}
          </span>

          <span className="flex items-center gap-1">
            <Users size={13} />
            {item.division}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <ClipboardList size={17} />
          <Folder size={17} />

          <span className="text-xs text-gray-500">
            {item.join_code}
          </span>
        </div>
      </div>
    </Link>
  );
}