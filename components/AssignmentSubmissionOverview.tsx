"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Paperclip,
  Search,
} from "lucide-react";

import { useAssignmentSubmissions, type RosterEntry } from "@/hooks/useAssignmentSubmissions";

interface AssignmentSubmissionOverviewProps {
  assignmentId: string;
  courseId: string;
  totalMarks: number | null;
}

type RosterStatus = "missing" | "submitted" | "late" | "graded";

function rosterStatus(entry: RosterEntry): RosterStatus {
  if (!entry.submission || entry.submission.status === "pending") return "missing";
  return entry.submission.status as RosterStatus;
}

const STATUS_STYLES: Record<RosterStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  missing: {
    label: "Missing",
    className:
      "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
    icon: Clock3,
  },
  submitted: {
    label: "Turned in",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300",
    icon: CheckCircle2,
  },
  late: {
    label: "Turned in late",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
    icon: Clock3,
  },
  graded: {
    label: "Graded",
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-300",
    icon: CheckCircle2,
  },
};

function StatusPill({ status }: { status: RosterStatus }) {
  const cfg = STATUS_STYLES[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

export function AssignmentSubmissionOverview({
  assignmentId,
  courseId,
  totalMarks,
}: AssignmentSubmissionOverviewProps) {
  const { roster, counts, loading } = useAssignmentSubmissions(assignmentId, courseId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return roster;
    return roster.filter((r) => {
      const name = r.student.full_name ?? "";
      const email = r.student.email ?? "";
      const roll = r.student.roll_number ?? "";
      return (
        name.toLowerCase().includes(value) ||
        email.toLowerCase().includes(value) ||
        roll.toLowerCase().includes(value)
      );
    });
  }, [search, roster]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading submissions...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Submissions
        </h2>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{counts.turnedIn}</p>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Turned in</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.enrolled}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Assigned</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-900/20">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{counts.missing}</p>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Missing</p>
          </div>
        </div>

        {roster.length > 0 && (
          <div className="relative mt-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name, email, or roll number..."
              aria-label="Search students"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100 p-2 dark:divide-gray-800 sm:p-3">
        {roster.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No students enrolled in this class yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No students match your search.
          </div>
        ) : (
          filtered.map((entry) => {
            const status = rosterStatus(entry);
            const submission = entry.submission;
            const fileCount = submission?.files.length ?? 0;
            const submittedLabel = submission?.submitted_at
              ? new Date(submission.submitted_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—";
            const scoreLabel =
              status === "graded" && submission?.marks !== null && submission?.marks !== undefined
                ? totalMarks !== null
                  ? `${submission.marks}/${totalMarks}`
                  : `${submission.marks}`
                : "—";

            return (
              <div
                key={entry.student.id}
                className="flex flex-col gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {(entry.student.full_name ?? entry.student.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 truncate font-medium text-gray-900 dark:text-white">
                      <span className="truncate">
                        {entry.student.full_name || entry.student.email}
                      </span>
                      {entry.student.roll_number && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {entry.student.roll_number}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {entry.student.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pl-14 sm:flex-nowrap sm:gap-5 sm:pl-0">
                  <StatusPill status={status} />

                  <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {submittedLabel}
                  </span>

                  <span className="w-16 shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                    {scoreLabel}
                  </span>

                  {fileCount > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Paperclip size={13} />
                      {fileCount}
                    </span>
                  )}

                  {submission ? (
                    <Link
                      href={`/dashboard/submissions/${submission.id}`}
                      className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 sm:ml-0"
                    >
                      <FileText size={13} />
                      Review
                    </Link>
                  ) : (
                    <span className="ml-auto shrink-0 text-xs text-gray-300 dark:text-gray-600 sm:ml-0">
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
