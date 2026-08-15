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
}

interface AssignmentForSummary {
  id: string;
  due_date: string | null;
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
          .select("assignment_id, submitted_at, status")
          .in("assignment_id", assignmentIds),
      ]);

      if (cancelled) return;

      const enrolled = new Set((enrollmentRows ?? []).map((e) => e.student_id)).size;

      const byAssignment = new Map<string, { submitted_at: string | null; status: string }[]>();
      (submissionRows ?? []).forEach((s) => {
        const list = byAssignment.get(s.assignment_id) ?? [];
        list.push({ submitted_at: s.submitted_at, status: s.status });
        byAssignment.set(s.assignment_id, list);
      });

      const next: Record<string, AssignmentCardSummary> = {};
      for (const assignment of assignments) {
        const subs = byAssignment.get(assignment.id) ?? [];
        let onTime = 0;
        let late = 0;
        let submitted = 0;

        subs.forEach((s) => {
          const hasSubmission = s.status !== "pending" && !!s.submitted_at;
          if (!hasSubmission) return;
          submitted++;
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
