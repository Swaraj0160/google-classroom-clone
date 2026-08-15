"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
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
import { exportAssignmentGradesToCsv } from "@/lib/export";
import { showToast } from "@/lib/toast";
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

type FilterKey =
  | "all"
  | "submitted"
  | "on_time"
  | "late"
  | "not_submitted"
  | "needs_review"
  | "reviewed"
  | "needs_attention";
type SortKey = "roll" | "name" | "status" | "marks" | "review";

const STATUS_STYLES: Record<
  SubmissionDisplayStatus,
  { className: string; icon: typeof CheckCircle2 }
> = {
  not_submitted: {
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300",
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
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
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

function ReviewPill({ reviewed, hasSubmission }: { reviewed: boolean; hasSubmission: boolean }) {
  if (!hasSubmission) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
  return reviewed ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-300">
      <CheckCircle2 size={11} /> Reviewed
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
      Needs review
    </span>
  );
}

function formatExactDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface Enriched {
  entry: RosterEntry;
  hasSubmission: boolean;
  displayStatus: SubmissionDisplayStatus;
  lateByMs: number | null;
  isGraded: boolean;
  reviewed: boolean;
  automaticMarks: number | null;
  finalMarks: number | null;
  needsAttention: boolean;
}

export function AssignmentSubmissionOverview({
  assignmentId,
  courseId,
  totalMarks,
  dueDate,
}: AssignmentSubmissionOverviewProps) {
  const { roster, counts, loading, saveGrade, setReviewed, bulkSetReviewed, bulkApplyGrade } =
    useAssignmentSubmissions(assignmentId, courseId);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("roll");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marksDraft, setMarksDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkGradeInput, setBulkGradeInput] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const enriched = useMemo<Enriched[]>(() => {
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
      const reviewed = hasSubmission && !!submission!.reviewed;
      const fileCount = submission?.files.length ?? 0;

      const needsAttention =
        !hasSubmission ||
        (hasSubmission &&
          (!reviewed ||
            !isGraded ||
            displayStatus === "late_within_48h" ||
            displayStatus === "late_after_48h" ||
            fileCount === 0));

      return {
        entry,
        hasSubmission,
        displayStatus,
        lateByMs,
        isGraded,
        reviewed,
        automaticMarks: suggestedMarks,
        finalMarks: isGraded ? submission!.marks : null,
        needsAttention,
      };
    });
  }, [roster, dueDate, totalMarks]);

  const needsAttentionCount = enriched.filter((e) => e.needsAttention).length;

  const summary = useMemo(() => {
    const onTime = enriched.filter((e) => e.displayStatus === "on_time").length;
    const late = enriched.filter(
      (e) => e.displayStatus === "late_within_48h" || e.displayStatus === "late_after_48h"
    ).length;
    const gradedMarks = enriched.filter((e) => e.isGraded).map((e) => e.finalMarks as number);
    const averageGrade =
      gradedMarks.length > 0 ? gradedMarks.reduce((a, b) => a + b, 0) / gradedMarks.length : null;
    return { onTime, late, averageGrade, gradedCount: gradedMarks.length };
  }, [enriched]);

  const analytics = useMemo(() => {
    const total = enriched.length;
    const submitted = enriched.filter((e) => e.hasSubmission).length;
    const auto = enriched.filter((e) => e.automaticMarks !== null).map((e) => e.automaticMarks as number);
    const avgAuto = auto.length ? auto.reduce((a, b) => a + b, 0) / auto.length : null;

    // Bucket by percentage so this works for any maxMarks scale.
    const buckets = [
      { label: "90–100%", min: 90, count: 0 },
      { label: "80–89%", min: 80, count: 0 },
      { label: "70–79%", min: 70, count: 0 },
      { label: "60–69%", min: 60, count: 0 },
      { label: "<60%", min: 0, count: 0 },
    ];
    if (totalMarks && totalMarks > 0) {
      enriched.forEach((e) => {
        if (e.finalMarks === null) return;
        const pct = (e.finalMarks / totalMarks) * 100;
        const bucket = buckets.find((b) => pct >= b.min) ?? buckets[buckets.length - 1];
        bucket.count++;
      });
    }
    const maxBucketCount = Math.max(1, ...buckets.map((b) => b.count));

    return {
      submissionRate: total ? Math.round((submitted / total) * 100) : 0,
      onTimeRate: submitted ? Math.round((summary.onTime / submitted) * 100) : 0,
      lateRate: submitted ? Math.round((summary.late / submitted) * 100) : 0,
      avgAuto,
      buckets,
      maxBucketCount,
    };
  }, [enriched, summary, totalMarks]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    return enriched.filter((item) => {
      const { entry, hasSubmission, displayStatus, reviewed, needsAttention } = item;
      if (filter === "submitted" && !hasSubmission) return false;
      if (filter === "on_time" && displayStatus !== "on_time") return false;
      if (filter === "not_submitted" && hasSubmission) return false;
      if (filter === "late" && displayStatus !== "late_within_48h" && displayStatus !== "late_after_48h")
        return false;
      if (filter === "needs_review" && (!hasSubmission || reviewed)) return false;
      if (filter === "reviewed" && (!hasSubmission || !reviewed)) return false;
      if (filter === "needs_attention" && !needsAttention) return false;

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
        list.sort((a, b) => (b.finalMarks ?? b.automaticMarks ?? -1) - (a.finalMarks ?? a.automaticMarks ?? -1));
        break;
      case "review":
        list.sort((a, b) => Number(a.reviewed) - Number(b.reviewed));
        break;
      case "roll":
      default:
        list.sort((a, b) => compareByRollNumber(a.entry.student, b.entry.student));
        break;
    }
    return list;
  }, [filtered, sortKey]);

  function toggleExpand(item: Enriched) {
    const id = item.entry.student.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setMarksDraft(item.finalMarks !== null ? String(item.finalMarks) : "");
    setFeedbackDraft(item.entry.submission?.feedback ?? "");
  }

  function toggleSelected(submissionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
  }

  const selectableIds = sorted.filter((e) => e.entry.submission).map((e) => e.entry.submission!.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(selectableIds);
    });
  }

  async function handleSaveGrade(item: Enriched) {
    const submission = item.entry.submission;
    if (!submission) return;

    const trimmed = marksDraft.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && Number.isNaN(parsed as number)) {
      showToast.error("Marks must be a valid number.");
      return;
    }
    if (parsed !== null && parsed < 0) {
      showToast.error("Marks cannot be negative.");
      return;
    }
    if (parsed !== null && totalMarks !== null && parsed > totalMarks) {
      showToast.error(`Marks cannot exceed total marks (${totalMarks}).`);
      return;
    }

    setSaving(true);
    await saveGrade(submission.id, parsed, feedbackDraft.trim() === "" ? null : feedbackDraft, dueDate);
    setSaving(false);
  }

  async function handleBulkApplyGrade() {
    const trimmed = bulkGradeInput.trim();
    const parsed = Number(trimmed);
    if (trimmed === "" || Number.isNaN(parsed) || parsed < 0) {
      showToast.error("Enter a valid, non-negative grade first.");
      return;
    }
    if (totalMarks !== null && parsed > totalMarks) {
      showToast.error(`Grade cannot exceed total marks (${totalMarks}).`);
      return;
    }
    setBulkBusy(true);
    await bulkApplyGrade(Array.from(selected), parsed, dueDate);
    setBulkBusy(false);
    setBulkGradeInput("");
    setSelected(new Set());
  }

  async function handleBulkReview(reviewed: boolean) {
    setBulkBusy(true);
    await bulkSetReviewed(Array.from(selected), reviewed);
    setBulkBusy(false);
    setSelected(new Set());
  }

  function handleExport() {
    if (sorted.length === 0) {
      showToast.error("No students to export.");
      return;
    }
    exportAssignmentGradesToCsv(
      sorted.map((item) => ({
        rollNumber: item.entry.student.roll_number?.trim() || "Not set",
        studentName: item.entry.student.full_name || item.entry.student.email,
        submissionStatus: item.hasSubmission ? "Submitted" : "Not submitted",
        submittedAt: formatExactDateTime(item.entry.submission?.submitted_at ?? null),
        lateStatus: formatLateness(item.lateByMs) ?? (item.hasSubmission ? "On time" : "—"),
        automaticGrade: item.automaticMarks !== null ? String(item.automaticMarks) : "—",
        finalGrade: item.finalMarks !== null ? String(item.finalMarks) : "Not graded",
        reviewStatus: !item.hasSubmission ? "—" : item.reviewed ? "Reviewed" : "Needs review",
        feedback: item.entry.submission?.feedback ?? "",
      })),
      `assignment-grades-${assignmentId}.csv`
    );
  }

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Student Submissions
          </h2>
          {roster.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Download size={13} /> Export Grades
            </button>
          )}
        </div>

        {/* Summary dashboard */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryTile label="Students" value={counts.enrolled} />
          <SummaryTile label="Submitted" value={counts.turnedIn} tone="blue" />
          <SummaryTile label="On Time" value={summary.onTime} tone="green" />
          <SummaryTile label="Late" value={summary.late} tone="amber" />
          <SummaryTile label="Not Submitted" value={counts.missing} tone="red" />
          <SummaryTile
            label="Avg. Grade"
            value={
              summary.averageGrade !== null
                ? `${summary.averageGrade.toFixed(1)}${totalMarks !== null ? ` / ${totalMarks}` : ""}`
                : "—"
            }
            tone="purple"
          />
        </div>

        {needsAttentionCount > 0 && (
          <button
            onClick={() => setFilter(filter === "needs_attention" ? "all" : "needs_attention")}
            className={`mt-3 flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
              filter === "needs_attention"
                ? "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
            }`}
          >
            <AlertTriangle size={14} className="shrink-0" />
            {needsAttentionCount} student{needsAttentionCount === 1 ? "" : "s"} need
            {needsAttentionCount === 1 ? "s" : ""} attention
          </button>
        )}

        {/* Compact analytics */}
        {counts.enrolled > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3.5 dark:bg-gray-800/50 sm:grid-cols-2">
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p>Submission rate: <span className="font-semibold text-gray-900 dark:text-white">{analytics.submissionRate}%</span></p>
              <p>On-time rate: <span className="font-semibold text-gray-900 dark:text-white">{analytics.onTimeRate}%</span></p>
              <p>Late rate: <span className="font-semibold text-gray-900 dark:text-white">{analytics.lateRate}%</span></p>
              {analytics.avgAuto !== null && (
                <p>
                  Avg. automatic grade:{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {analytics.avgAuto.toFixed(1)}
                    {totalMarks !== null ? ` / ${totalMarks}` : ""}
                  </span>
                </p>
              )}
            </div>
            {summary.gradedCount > 0 && (
              <div className="space-y-1">
                {analytics.buckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="w-16 shrink-0">{b.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(b.count / analytics.maxBucketCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {roster.length > 0 && (
          <>
            <div className="relative mt-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name or roll number..."
                aria-label="Search students"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["submitted", "Submitted"],
                    ["on_time", "On Time"],
                    ["late", "Late"],
                    ["not_submitted", "Not Submitted"],
                    ["needs_review", "Needs Review"],
                    ["reviewed", "Reviewed"],
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
                <option value="review">Sort: Review status</option>
              </select>
            </div>
          </>
        )}

        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 dark:border-blue-900 dark:bg-blue-900/20">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              {selected.size} selected
            </span>
            <button
              disabled={bulkBusy}
              onClick={() => handleBulkReview(true)}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50 dark:bg-gray-800 dark:text-blue-300"
            >
              Mark Reviewed
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => handleBulkReview(false)}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50 dark:bg-gray-800 dark:text-blue-300"
            >
              Needs Review
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={bulkGradeInput}
                onChange={(e) => setBulkGradeInput(e.target.value)}
                placeholder="Grade"
                className="w-16 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-gray-800"
              />
              <button
                disabled={bulkBusy}
                onClick={handleBulkApplyGrade}
                className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Apply Grade
              </button>
            </div>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear
            </button>
          </div>
        )}

        {selectableIds.length > 0 && (
          <label className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded" />
            Select all submitted
          </label>
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
          sorted.map((item) => {
            const { entry, hasSubmission, displayStatus, lateByMs, isGraded, reviewed, automaticMarks, finalMarks } = item;
            const submission = entry.submission;
            const fileCount = submission?.files.length ?? 0;
            const isExpanded = expandedId === entry.student.id;
            const latenessLabel = formatLateness(lateByMs);

            return (
              <div key={entry.student.id} className="rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                <div className="flex items-center gap-2 p-3">
                  {submission && (
                    <input
                      type="checkbox"
                      checked={selected.has(submission.id)}
                      onChange={() => toggleSelected(submission.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${entry.student.full_name || entry.student.email}`}
                      className="h-3.5 w-3.5 shrink-0 rounded"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(item)}
                    className="flex min-w-0 flex-1 flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
                          <span className="truncate">{entry.student.full_name || entry.student.email}</span>
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
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{entry.student.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pl-14 sm:flex-nowrap sm:gap-4 sm:pl-0">
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
                      <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        {isGraded
                          ? `Final: ${finalMarks}${totalMarks !== null ? `/${totalMarks}` : ""}`
                          : automaticMarks !== null
                          ? `Auto: ${automaticMarks}${totalMarks !== null ? `/${totalMarks}` : ""}`
                          : "—"}
                      </span>
                      <ReviewPill reviewed={reviewed} hasSubmission={hasSubmission} />
                      {fileCount > 0 && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Paperclip size={13} />
                          {fileCount}
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-4 mr-3 mb-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Student</h4>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.student.full_name || "—"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.student.roll_number ? `Roll No.: ${entry.student.roll_number}` : "Roll No.: Not set"}
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
                          Submitted at: {formatExactDateTime(submission?.submitted_at ?? null)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Deadline: {formatExactDateTime(dueDate)}
                        </p>
                        {latenessLabel ? (
                          <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {latenessLabel}
                          </p>
                        ) : hasSubmission ? (
                          <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">On time</p>
                        ) : null}
                      </div>
                    </div>

                    {hasSubmission && (
                      <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900">
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Grading
                        </h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] text-gray-400">Automatic grade</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {automaticMarks !== null
                                ? `${automaticMarks}${totalMarks !== null ? ` / ${totalMarks}` : ""}`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-400">Final grade</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {isGraded
                                ? `${finalMarks}${totalMarks !== null ? ` / ${totalMarks}` : ""}`
                                : "Not graded"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-gray-400">
                              Final grade {totalMarks !== null ? `(out of ${totalMarks})` : ""}
                            </label>
                            <input
                              type="number"
                              value={marksDraft}
                              onChange={(e) => setMarksDraft(e.target.value)}
                              placeholder="—"
                              className="w-24 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                            />
                          </div>
                          {automaticMarks !== null && String(automaticMarks) !== marksDraft && (
                            <button
                              onClick={() => setMarksDraft(String(automaticMarks))}
                              className="rounded-full border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              Use {automaticMarks}
                              {totalMarks !== null ? `/${totalMarks}` : ""}
                            </button>
                          )}
                          <button
                            onClick={() => handleSaveGrade(item)}
                            disabled={saving}
                            className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {saving ? "Saving…" : "Save Grade"}
                          </button>
                          <button
                            onClick={() => setReviewed(submission!.id, !reviewed)}
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            {reviewed ? "Mark as Needs Review" : "Mark Reviewed"}
                          </button>
                        </div>

                        <div className="mt-3">
                          <label className="mb-1 block text-[11px] font-medium text-gray-400">Feedback</label>
                          <textarea
                            value={feedbackDraft}
                            onChange={(e) => setFeedbackDraft(e.target.value)}
                            rows={3}
                            placeholder="Write feedback for the student..."
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                          />
                        </div>
                      </div>
                    )}

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
                        Open full review page
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

function SummaryTile({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number | string;
  tone?: "gray" | "blue" | "green" | "amber" | "red" | "purple";
}) {
  const tones: Record<string, string> = {
    gray: "bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    green: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
  };
  return (
    <div className={`rounded-xl p-3 text-center ${tones[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}
