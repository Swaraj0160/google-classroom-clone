"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Search,
  XCircle,
} from "lucide-react";

import { useAssignmentSubmissions, type RosterEntry } from "@/hooks/useAssignmentSubmissions";
import { compareByRollNumber } from "@/lib/format";
import { SubmissionFileList } from "@/components/SubmissionFileList";
import {
  calculateSubmissionGrade,
  describeSubmissionStatus,
  formatLateness,
  SUBMISSION_STATUS_LABEL,
  type SubmissionDisplayStatus,
} from "@/lib/grading";

interface AssignmentSubmissionOverviewProps {
  assignmentId: string;
  courseId: string;
  totalMarks: number | null;
  dueDate: string | null;
}

type FilterKey = "all" | "submitted" | "not_submitted" | "late";
type SortKey = "roll" | "name" | "status" | "marks";

const STATUS_STYLES: Record<
  SubmissionDisplayStatus,
  { className: string; icon: typeof CheckCircle2 }
> = {
  not_submitted: {
    className:
      "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
    icon: XCircle,
  },
  on_time: {
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-300",
    icon: CheckCircle2,
  },
  late_within_48h: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
    icon: Clock3,
  },
  late_after_48h: {
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300",
    icon: Clock3,
  },
};

function StatusPill({ status }: { status: SubmissionDisplayStatus }) {
  const cfg = STATUS_STYLES[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className}`}
    >
      <Icon size={12} />
      {SUBMISSION_STATUS_LABEL[status]}
    </span>
  );
}

function formatExactDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AssignmentSubmissionOverview({
  assignmentId,
  courseId,
  totalMarks,
  dueDate,
}: AssignmentSubmissionOverviewProps) {
  const { roster, counts, loading } = useAssignmentSubmissions(assignmentId, courseId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("roll");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Each entry's timing/suggested-grade is derived once per render from the
  // authoritative submitted_at/due_date/total_marks — never persisted here.
  const enriched = useMemo(() => {
    return roster.map((entry) => {
      const submission = entry.submission;
      const hasSubmission = !!submission && submission.status !== "pending" && !!submission.submitted_at;
      const { suggestedMarks, timingCategory, lateByMs } = calculateSubmissionGrade({
        dueAt: dueDate,
        submittedAt: hasSubmission ? submission!.submitted_at : null,
        maxMarks: totalMarks,
      });
      const displayStatus = describeSubmissionStatus(hasSubmission, timingCategory);
      const isGraded = hasSubmission && submission!.status === "graded" && submission!.marks !== null;
      const displayMarks = isGraded ? submission!.marks : hasSubmission ? suggestedMarks : null;

      return { entry, hasSubmission, displayStatus, lateByMs, isGraded, displayMarks };
    });
  }, [roster, dueDate, totalMarks]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    return enriched.filter(({ entry, hasSubmission, displayStatus }) => {
      if (filter === "submitted" && !hasSubmission) return false;
      if (filter === "not_submitted" && hasSubmission) return false;
      if (filter === "late" && displayStatus !== "late_within_48h" && displayStatus !== "late_after_48h")
        return false;

      if (!value) return true;
      const name = entry.student.full_name ?? "";
      const email = entry.student.email ?? "";
      const roll = entry.student.roll_number ?? "";
      return (
        name.toLowerCase().includes(value) ||
        email.toLowerCase().includes(value) ||
        roll.toLowerCase().includes(value)
      );
    });
  }, [enriched, search, filter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortKey) {
      case "name":
        list.sort((a, b) =>
          (a.entry.student.full_name ?? a.entry.student.email).localeCompare(
            b.entry.student.full_name ?? b.entry.student.email
          )
        );
        break;
      case "status":
        list.sort((a, b) => a.displayStatus.localeCompare(b.displayStatus));
        break;
      case "marks":
        list.sort((a, b) => (b.displayMarks ?? -1) - (a.displayMarks ?? -1));
        break;
      case "roll":
      default:
        list.sort((a, b) => compareByRollNumber(a.entry.student, b.entry.student));
        break;
    }
    return list;
  }, [filtered, sortKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading submissions...
      </div>
    );
  }

  const lateCount = enriched.filter(
    (e) => e.displayStatus === "late_within_48h" || e.displayStatus === "late_after_48h"
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Student Submissions
        </h2>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{counts.turnedIn}</p>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Turned in</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.enrolled}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Enrolled</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-900/20">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{counts.missing}</p>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Not submitted</p>
          </div>
        </div>

        {roster.length > 0 && (
          <>
            <div className="relative mt-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                aria-label="Search students"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", `All (${roster.length})`],
                    ["submitted", `Submitted (${counts.turnedIn})`],
                    ["not_submitted", `Not Submitted (${counts.missing})`],
                    ["late", `Late (${lateCount})`],
                  ] as [FilterKey, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filter === key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="Sort students"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <option value="roll">Sort: Roll No.</option>
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
                <option value="marks">Sort: Marks</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div className="divide-y divide-gray-100 p-2 dark:divide-gray-800 sm:p-3">
        {roster.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No students enrolled in this class yet.
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No students match your search/filter.
          </div>
        ) : (
          sorted.map(({ entry, hasSubmission, displayStatus, lateByMs, isGraded, displayMarks }) => {
            const submission = entry.submission;
            const fileCount = submission?.files.length ?? 0;
            const isExpanded = expandedId === entry.student.id;
            const latenessLabel = formatLateness(lateByMs);
            const marksLabel =
              displayMarks !== null
                ? totalMarks !== null
                  ? `${displayMarks}/${totalMarks}`
                  : `${displayMarks}`
                : hasSubmission
                ? "Not graded"
                : "—";

            return (
              <div key={entry.student.id} className="rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.student.id)}
                  className="flex w-full flex-col gap-3 p-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  aria-expanded={isExpanded}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {(entry.student.full_name ?? entry.student.email ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 truncate font-medium text-gray-900 dark:text-white">
                        <span className="truncate">
                          {entry.student.full_name || entry.student.email}
                        </span>
                        {entry.student.roll_number ? (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Roll {entry.student.roll_number}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                            Roll No.: Not set
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {entry.student.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pl-14 sm:flex-nowrap sm:gap-5 sm:pl-0">
                    <StatusPill status={displayStatus} />

                    <span className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {submission?.submitted_at
                        ? new Date(submission.submitted_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>

                    <span className="w-20 shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                      {marksLabel}
                      {hasSubmission && !isGraded && displayMarks !== null && (
                        <span className="ml-1 text-[10px] font-normal text-gray-400">(auto)</span>
                      )}
                    </span>

                    {fileCount > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Paperclip size={13} />
                        {fileCount}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="ml-14 mr-3 mb-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Student
                        </h4>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.student.full_name || "—"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.student.roll_number
                            ? `Roll No.: ${entry.student.roll_number}`
                            : "Roll No.: Not set"}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Mail size={12} /> {entry.student.email}
                        </p>
                      </div>

                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Submission
                        </h4>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {hasSubmission ? "Submitted" : "Not submitted"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatExactDateTime(submission?.submitted_at ?? null)}
                        </p>
                        {latenessLabel && (
                          <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {latenessLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Marks
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {marksLabel}
                        </span>
                        {hasSubmission && !isGraded && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Auto-calculated suggestion based on submission timing — not yet graded by faculty.
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Uploaded Files
                      </h4>
                      {fileCount > 0 ? (
                        <SubmissionFileList files={submission!.files} />
                      ) : (
                        <p className="text-sm text-gray-400">No files uploaded.</p>
                      )}
                    </div>

                    {submission && (
                      <Link
                        href={`/dashboard/submissions/${submission.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <FileText size={13} />
                        Open full review &amp; grade
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
