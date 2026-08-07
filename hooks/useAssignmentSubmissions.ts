"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import type {
  SubmissionWithStudent,
  SubmissionCounts,
  AssignmentSummary,
} from "@/types/submission";

interface UseAssignmentSubmissionsResult {
  assignment: AssignmentSummary | null;
  submissions: SubmissionWithStudent[];
  counts: SubmissionCounts;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAssignmentSubmissions(
  assignmentId: string
): UseAssignmentSubmissionsResult {
  const [assignment, setAssignment] =
    useState<AssignmentSummary | null>(null);

  const [submissions, setSubmissions] = useState<
    SubmissionWithStudent[]
  >([]);

  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [
      { data: assignmentData, error: assignmentError },
      { data: submissionsData, error: submissionsError },
    ] = await Promise.all([
      supabase
        .from("assignments")
        .select("id, course_id, title, due_date, total_marks")
        .eq("id", assignmentId)
        .single(),

      supabase
        .from("submissions")
        .select(`
          *,
          files:submission_files(*),
          student:profiles!submissions_student_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .eq("assignment_id", assignmentId)
        .order("created_at"),
    ]);

    if (assignmentError) {
      showToast.error("Failed to load assignment.");
    } else {
      setAssignment(assignmentData as AssignmentSummary);
    }

    if (submissionsError) {
      showToast.error("Failed to load submissions.");
    } else {
      setSubmissions(
        (submissionsData ?? []) as SubmissionWithStudent[]
      );
    }

    setLoading(false);
  }, [assignmentId]);

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

  const counts = useMemo<SubmissionCounts>(() => {
    const result: SubmissionCounts = {
      total: submissions.length,
      pending: 0,
      submitted: 0,
      late: 0,
      graded: 0,
    };

    submissions.forEach((submission) => {
      switch (submission.status) {
        case "pending":
          result.pending++;
          break;

        case "submitted":
          result.submitted++;
          break;

        case "late":
          result.late++;
          break;

        case "graded":
          result.graded++;
          break;
      }
    });

    return result;
  }, [submissions]);

  return {
    assignment,
    submissions,
    counts,
    loading,
    refresh: fetchAll,
  };
}