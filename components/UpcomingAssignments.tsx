"use client";

import Link from "next/link";
import { AlertCircle, CalendarClock, CheckCircle2 } from "lucide-react";
import { useUpcomingAssignments } from "@/hooks/useUpcomingAssignments";

export function UpcomingAssignments() {
  const { items, loading } = useUpcomingAssignments();

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-50 dark:bg-gray-800/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock size={18} className="text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing due soon.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                item.overdue
                  ? "border-red-200 dark:border-red-900/50"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {item.title}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.courseTitle}</p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-xs font-medium ${
                    item.overdue
                      ? "text-red-600 dark:text-red-400"
                      : item.dueToday
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {item.overdue
                    ? "Overdue"
                    : item.dueToday
                    ? "Due today"
                    : new Date(item.dueDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                </p>
                {item.missingCount !== null ? (
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-gray-400">
                    {item.completed ? (
                      <CheckCircle2 size={11} className="text-green-500" />
                    ) : (
                      <AlertCircle size={11} className="text-amber-500" />
                    )}
                    {item.missingCount === 0 ? "All turned in" : `${item.missingCount} missing`}
                  </p>
                ) : (
                  item.completed && (
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-green-600 dark:text-green-400">
                      <CheckCircle2 size={11} /> Submitted
                    </p>
                  )
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
