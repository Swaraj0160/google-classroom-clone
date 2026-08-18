"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { compareByRollNumber } from "@/lib/format";
import { deriveStatusAfterManualGrade } from "@/lib/grading";
import type { SubmissionStudent, SubmissionWithFiles } from "@/types/submission";

export interface RosterEntry {
  student: SubmissionStudent;
  submission: SubmissionWithFiles | null;
}

export interface RosterCounts {
  enrolled: number;
  turnedIn: number;
  missing: number;
}

interface UseAssignmentSubmissionsResult {
  roster: RosterEntry[];
  counts: RosterCounts;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Sets marks + feedback the same way the full grading page does (same
   *  status-transition rule, same validation contract) — one grading
   *  system, two entry points. dueAt/maxMarks are only used to recompute
   *  "was this late" for the status transition, never to invent a grade. */
  saveGrade: (
    submissionId: string,
    marks: number | null,
    feedback: string | null,
    dueAt: string | null,
    successMessage?: string
  ) => Promise<boolean>;
  setReviewed: (submissionId: string, reviewed: boolean) => Promise<boolean>;
  bulkSetReviewed: (submissionIds: string[], reviewed: boolean) => Promise<void>;
  bulkApplyGrade: (submissionIds: string[], marks: number, dueAt: string | null) => Promise<void>;
}

const TURNED_IN_STATUSES = new Set(["submitted", "late", "graded"]);

export function useAssignmentSubmissions(
  assignmentId: string,
  courseId: string
): UseAssignmentSubmissionsResult {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // enrollments and submissions are independent (both only need the ids we
    // already have), so fetch concurrently.
    const [
      { data: enrollmentRows, error: enrollError },
      { data: submissionsData, error: submissionsError },
    ] = await Promise.all([
      supabase.from("enrollments").select("student_id").eq("course_id", courseId),
      supabase
        .from("submissions")
        .select("*, files:submission_files(*)")
        .eq("assignment_id", assignmentId),
    ]);

    if (enrollError) showToast.error("Failed to load enrolled students.");
    if (submissionsError) showToast.error("Failed to load submissions.");

    const studentIds = [...new Set((enrollmentRows ?? []).map((e) => e.student_id))];

    let profiles: SubmissionStudent[] = [];
    if (studentIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, roll_number")
        .in("id", studentIds);

      if (profilesError) {
        showToast.error("Failed to load student profiles.");
      } else {
        profiles = (profileRows ?? []) as SubmissionStudent[];
      }

      if (profiles.length < studentIds.length) {
        console.warn(
          "[useAssignmentSubmissions] enrolled student_id(s) with no resolvable profile row",
          studentIds.filter((id) => !profiles.some((p) => p.id === id))
        );
      }
    }

    const submissionByStudent = new Map(
      (submissionsData ?? []).map((s) => [
        s.student_id as string,
        // `reviewed` may not exist yet on databases that haven't run the
        // migration — select("*") never errors over a missing column (it
        // only returns whichever columns currently exist), so default it
        // here rather than requiring the column up front.
        { ...s, reviewed: Boolean((s as { reviewed?: boolean }).reviewed) } as SubmissionWithFiles,
      ])
    );

    const nextRoster: RosterEntry[] = profiles
      .map((student) => ({
        student,
        submission: submissionByStudent.get(student.id) ?? null,
      }))
      .sort((a, b) => compareByRollNumber(a.student, b.student));

    setRoster(nextRoster);
    setLoading(false);
  }, [assignmentId, courseId]);

  useEffect(() => {
    void fetchAll();

    const channel = supabase
      .channel(`assignment-${assignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `assignment_id=eq.${assignmentId}`,
        },
        () => {
          void fetchAll();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submission_files",
        },
        () => {
          void fetchAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, fetchAll]);

  const counts = useMemo<RosterCounts>(() => {
    const turnedIn = roster.filter(
      (r) => r.submission && TURNED_IN_STATUSES.has(r.submission.status)
    ).length;
    return {
      enrolled: roster.length,
      turnedIn,
      missing: roster.length - turnedIn,
    };
  }, [roster]);

  const patchSubmission = useCallback((submissionId: string, patch: Partial<SubmissionWithFiles>) => {
    setRoster((prev) =>
      prev.map((entry) =>
        entry.submission?.id === submissionId
          ? { ...entry, submission: { ...entry.submission, ...patch } }
          : entry
      )
    );
  }, []);

  const saveGrade = useCallback(
    async (
      submissionId: string,
      marks: number | null,
      feedback: string | null,
      dueAt: string | null,
      successMessage = "Grade saved."
    ): Promise<boolean> => {
      const current = roster.find((r) => r.submission?.id === submissionId)?.submission;
      if (!current) return false;

      const wasLate =
        !!current.submitted_at && !!dueAt && new Date(current.submitted_at) > new Date(dueAt);
      const newStatus = deriveStatusAfterManualGrade(current.status, wasLate, marks);

      // marks/feedback/status is the exact same update the existing full
      // grading page performs — this must succeed regardless of whether the
      // `reviewed` column migration has been applied yet.
      const { error } = await supabase
        .from("submissions")
        .update({ marks, feedback, status: newStatus })
        .eq("id", submissionId);

      if (error) {
        showToast.error("Failed to save grade.");
        return false;
      }

      patchSubmission(submissionId, { marks, feedback, status: newStatus as SubmissionWithFiles["status"] });

      // Grading a submission is a natural point to also mark it reviewed —
      // never the other way around (un-grading doesn't un-review it). Best
      // effort: on a database that hasn't run the `reviewed` migration yet,
      // this column doesn't exist and the update below fails — the grade
      // above is already saved, so we only warn, not fail the whole action.
      if (marks !== null && !current.reviewed) {
        const { error: reviewedError } = await supabase
          .from("submissions")
          .update({ reviewed: true })
          .eq("id", submissionId);
        if (!reviewedError) patchSubmission(submissionId, { reviewed: true });
      }

      // Empty string = caller will show its own combined summary toast
      // (used by bulk operations so N selections don't produce N toasts).
      if (successMessage) showToast.success(successMessage);
      return true;
    },
    [roster, patchSubmission]
  );

  const setReviewed = useCallback(
    async (submissionId: string, reviewed: boolean): Promise<boolean> => {
      const { error } = await supabase.from("submissions").update({ reviewed }).eq("id", submissionId);
      if (error) {
        showToast.error(
          error.code === "42703"
            ? "Review status isn't set up yet on this database (run the pending migration)."
            : "Failed to update review status."
        );
        return false;
      }
      patchSubmission(submissionId, { reviewed });
      return true;
    },
    [patchSubmission]
  );

  const bulkSetReviewed = useCallback(
    async (submissionIds: string[], reviewed: boolean) => {
      if (submissionIds.length === 0) return;
      const { error } = await supabase.from("submissions").update({ reviewed }).in("id", submissionIds);
      if (error) {
        showToast.error(
          error.code === "42703"
            ? "Review status isn't set up yet on this database (run the pending migration)."
            : "Failed to update review status for selected students."
        );
        return;
      }
      submissionIds.forEach((id) => patchSubmission(id, { reviewed }));
      showToast.success(`${submissionIds.length} submission(s) marked ${reviewed ? "reviewed" : "needs review"}.`);
    },
    [patchSubmission]
  );

  const bulkApplyGrade = useCallback(
    async (submissionIds: string[], marks: number, dueAt: string | null) => {
      if (submissionIds.length === 0) return;
      let succeeded = 0;
      for (const id of submissionIds) {
        // eslint-disable-next-line no-await-in-loop -- sequential to keep per-row status logic simple and correct
        const ok = await saveGrade(id, marks, null, dueAt, "");
        if (ok) succeeded++;
      }
      if (succeeded > 0) {
        showToast.success(`Applied ${marks} to ${succeeded} submission(s).`);
      }
    },
    [saveGrade]
  );

  return {
    roster,
    counts,
    loading,
    refresh: fetchAll,
    saveGrade,
    setReviewed,
    bulkSetReviewed,
    bulkApplyGrade,
  };
}
