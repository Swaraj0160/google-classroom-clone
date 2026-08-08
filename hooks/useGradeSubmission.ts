"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import type { Submission } from "@/types/submission";

export interface GradeInput {
  submissionId: string;
  marks: number | null;
  feedback: string;
  facultyId: string;
}

interface UseGradeSubmissionResult {
  grading: boolean;
  gradeSubmission: (
    input: GradeInput
  ) => Promise<Submission | null>;
}

export function useGradeSubmission(): UseGradeSubmissionResult {
  const [grading, setGrading] = useState(false);

  const gradeSubmission = useCallback(
    async ({
      submissionId,
      marks,
      feedback,
    }: GradeInput): Promise<Submission | null> => {
      if (marks === null || Number.isNaN(marks)) {
        showToast.error("Please enter a valid grade.");
        return null;
      }

      if (marks < 0) {
        showToast.error("Grade cannot be negative.");
        return null;
      }

      setGrading(true);

      try {
        const { data, error } = await supabase
          .from("submissions")
          .update({
            marks,
            feedback,
            status: "graded",
          })
          .eq("id", submissionId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        showToast.success("Submission graded successfully.");

        return data as Submission;
      } catch (error) {
        console.error(error);
        showToast.error("Failed to grade submission.");
        return null;
      } finally {
        setGrading(false);
      }
    },
    []
  );

  return {
    grading,
    gradeSubmission,
  };
}