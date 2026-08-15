/**
 * Single source of truth for "how late was this submission, and what would
 * it score under the standard late-penalty policy". Used by the faculty
 * assignment-detail Student Submissions view. Read-only/derived — never
 * writes to the database. The only persistent grade is still whatever a
 * faculty member enters on the submission review page; this only computes
 * a *suggested* grade to show before that happens.
 *
 * Policy (inclusive boundaries — exactly at a threshold favors the student):
 *   submitted_at <= due_at                    -> on time      -> 100% of max
 *   due_at < submitted_at <= due_at + 48h      -> late <=48h   ->  80% of max
 *   submitted_at > due_at + 48h                -> late >48h    ->  70% of max
 * No due date on the assignment means there is no deadline to miss, so a
 * submission is always treated as on time (matches the existing convention
 * in components/class/MarksTab.tsx's submissionTiming()).
 */

const LATE_WINDOW_MS = 48 * 60 * 60 * 1000;

export type TimingCategory = "on_time" | "late_within_48h" | "late_after_48h";

export interface GradeCalculationInput {
  dueAt: string | null;
  submittedAt: string | null;
  maxMarks: number | null;
}

export interface GradeCalculationResult {
  /** null when there's nothing to compute (no submission, or no max marks configured). */
  suggestedMarks: number | null;
  timingCategory: TimingCategory | null;
  /** Milliseconds late; 0 or negative means on time. Null when not computable. */
  lateByMs: number | null;
}

export function calculateSubmissionGrade({
  dueAt,
  submittedAt,
  maxMarks,
}: GradeCalculationInput): GradeCalculationResult {
  if (!submittedAt) {
    return { suggestedMarks: null, timingCategory: null, lateByMs: null };
  }

  const submittedTime = new Date(submittedAt).getTime();

  let timingCategory: TimingCategory = "on_time";
  let lateByMs: number | null = null;

  if (dueAt) {
    const dueTime = new Date(dueAt).getTime();
    lateByMs = submittedTime - dueTime;
    if (lateByMs <= 0) {
      timingCategory = "on_time";
    } else if (lateByMs <= LATE_WINDOW_MS) {
      timingCategory = "late_within_48h";
    } else {
      timingCategory = "late_after_48h";
    }
  }

  if (maxMarks === null || maxMarks === undefined) {
    return { suggestedMarks: null, timingCategory, lateByMs };
  }

  const multiplier =
    timingCategory === "on_time" ? 1 : timingCategory === "late_within_48h" ? 0.8 : 0.7;

  return { suggestedMarks: Math.round(maxMarks * multiplier), timingCategory, lateByMs };
}

/** "Late by 6 hours" / "Late by 1 day 4 hours" / "Late by 3 days" — null/≤0 means not late. */
export function formatLateness(lateByMs: number | null): string | null {
  if (lateByMs === null || lateByMs <= 0) return null;

  const totalMinutes = Math.floor(lateByMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);

  if (days === 0 && hours === 0) return "Late by a few minutes";
  if (days === 0) return `Late by ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours === 0) return `Late by ${days} day${days === 1 ? "" : "s"}`;
  return `Late by ${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
}

export type SubmissionDisplayStatus =
  | "not_submitted"
  | "on_time"
  | "late_within_48h"
  | "late_after_48h";

export const SUBMISSION_STATUS_LABEL: Record<SubmissionDisplayStatus, string> = {
  not_submitted: "Not submitted",
  on_time: "Submitted on time",
  late_within_48h: "Submitted late — within 2 days",
  late_after_48h: "Submitted late — more than 2 days",
};

export function describeSubmissionStatus(
  hasSubmission: boolean,
  timingCategory: TimingCategory | null
): SubmissionDisplayStatus {
  if (!hasSubmission) return "not_submitted";
  if (timingCategory === "late_within_48h") return "late_within_48h";
  if (timingCategory === "late_after_48h") return "late_after_48h";
  return "on_time";
}
