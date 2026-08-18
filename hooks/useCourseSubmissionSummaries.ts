"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calculateSubmissionGrade, describeSubmissionStatus } from "@/lib/grading";

export interface AssignmentCardSummary {
  enrolled: number;
  submitted: number;
  onTime: number;
  late: number;
  notSubmitted: number;
  graded: number;
  pendingReview: number;
  /** Average of officially awarded marks only — never automatic suggestions. Null when nothing is graded yet. */
  averageGrade: number | null;
}

interface AssignmentForSummary {
  id: string;
  due_date: string | null;
  total_marks: number | null;
}

/**
 * Per-assignment submission counts for the Classwork card list — batched
 * into exactly two queries (course enrollment count once, then every
 * assignment's submissions in one `.in(assignment_id, [...])` call), no
 * matter how many assignments the course has. Reuses the same
 * describeSubmissionStatus()/calculateSubmissionGrade() timing rules the
 * assignment-detail Student Submissions dashboard uses, so the card
 * summary and the dashboard can never disagree.
 */
export function useCourseSubmissionSummaries(
  courseId: string,
  assignments: AssignmentForSummary[]
): { summaries: Record<string, AssignmentCardSummary>; loading: boolean } {
  const [summaries, setSummaries] = useState<Record<string, AssignmentCardSummary>>({});
  const [loading, setLoading] = useState(true);

  // Stable key so the effect only re-runs when the actual set of assignment
  // ids/due dates changes, not on every parent re-render.
  const assignmentKey = assignments.map((a) => `${a.id}:${a.due_date ?? ""}`).join(",");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      if (!courseId || assignments.length === 0) {
        if (!cancelled) {
          setSummaries({});
          setLoading(false);
        }
        return;
      }

      const assignmentIds = assignments.map((a) => a.id);

      const [{ data: enrollmentRows }, { data: submissionRows }] = await Promise.all([
        supabase.from("enrollments").select("student_id").eq("course_id", courseId),
        supabase
          .from("submissions")
          .select("assignment_id, submitted_at, status, marks")
          .in("assignment_id", assignmentIds),
      ]);

      if (cancelled) return;

      const enrolled = new Set((enrollmentRows ?? []).map((e) => e.student_id)).size;

      const byAssignment = new Map<
        string,
        { submitted_at: string | null; status: string; marks: number | null }[]
      >();
      (submissionRows ?? []).forEach((s) => {
        const list = byAssignment.get(s.assignment_id) ?? [];
        list.push({ submitted_at: s.submitted_at, status: s.status, marks: s.marks });
        byAssignment.set(s.assignment_id, list);
      });

      const next: Record<string, AssignmentCardSummary> = {};
      for (const assignment of assignments) {
        const subs = byAssignment.get(assignment.id) ?? [];
        let onTime = 0;
        let late = 0;
        let submitted = 0;
        let graded = 0;
        const gradedMarks: number[] = [];

        subs.forEach((s) => {
          const hasSubmission = s.status !== "pending" && !!s.submitted_at;
          if (!hasSubmission) return;
          submitted++;

          // Official grade status — only "graded" with a real marks value
          // counts. Never derived from the automatic timing suggestion.
          if (s.status === "graded" && s.marks !== null) {
            graded++;
            gradedMarks.push(s.marks);
          }

          const { timingCategory } = calculateSubmissionGrade({
            dueAt: assignment.due_date,
            submittedAt: s.submitted_at,
            maxMarks: null,
          });
          const displayStatus = describeSubmissionStatus(true, timingCategory);
          if (displayStatus === "late_within_48h" || displayStatus === "late_after_48h") late++;
          else onTime++;
        });

        next[assignment.id] = {
          enrolled,
          submitted,
          onTime,
          late,
          notSubmitted: Math.max(0, enrolled - submitted),
          graded,
          pendingReview: Math.max(0, submitted - graded),
          averageGrade:
            gradedMarks.length > 0
              ? gradedMarks.reduce((a, b) => a + b, 0) / gradedMarks.length
              : null,
        };
      }

      setSummaries(next);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assignmentKey captures the real dependency (ids + due dates)
  }, [courseId, assignmentKey]);

  return { summaries, loading };
}
