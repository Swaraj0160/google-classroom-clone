"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  CalendarDays,
  Award,
} from "lucide-react";

import { useGradeSubmission } from "@/hooks/useGradeSubmission";
import { SubmissionFileList } from "@/components/SubmissionFileList";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import type { SubmissionWithStudent } from "@/types/submission";

interface GradingPanelProps {
  submission: SubmissionWithStudent;
  maxPoints: number | null;
  facultyId: string;
  onGraded?: () => void;
}

export function GradingPanel({
  submission,
  maxPoints,
  facultyId,
  onGraded,
}: GradingPanelProps) {
  const { grading, gradeSubmission } =
    useGradeSubmission();

  const [grade, setGrade] = useState(
    submission.marks?.toString() ?? ""
  );

  const [feedback, setFeedback] = useState(
    submission.feedback ?? ""
  );

  useEffect(() => {
    setGrade(submission.marks?.toString() ?? "");
    setFeedback(submission.feedback ?? "");
  }, [submission]);

  const canGrade =
    submission.status === "submitted" ||
    submission.status === "late" ||
    submission.status === "graded";

  async function handleSave() {
    const value = Number(grade);

    if (Number.isNaN(value)) return;

    const result = await gradeSubmission({
      submissionId: submission.id,
      marks: value,
      feedback,
      facultyId,
    });

    if (result) {
      onGraded?.();
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {submission.student?.full_name ??
              submission.student?.email}
          </h2>

          {submission.submitted_at && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <CalendarDays size={15} />
              Submitted{" "}
              {new Date(
                submission.submitted_at
              ).toLocaleString()}
            </div>
          )}
        </div>

        <SubmissionStatusBadge
          status={submission.status}
        />
      </div>

      <div className="mt-6">
        <SubmissionFileList
          files={submission.files}
        />
      </div>

      {!canGrade ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400 dark:border-gray-700">
          Student has not submitted any work yet.
        </div>
      ) : (
        <>
          <div className="mt-8 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
            <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <Award size={18} />
              Grade
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="number"
                value={grade}
                onChange={(e) =>
                  setGrade(e.target.value)
                }
                min={0}
                max={maxPoints ?? undefined}
                className="w-28 rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />

              {maxPoints !== null && (
                <span className="text-gray-500">
                  / {maxPoints}
                </span>
              )}
            </div>

            <textarea
              rows={5}
              value={feedback}
              onChange={(e) =>
                setFeedback(e.target.value)
              }
              placeholder="Private feedback..."
              className="mt-5 w-full rounded-xl border border-gray-300 p-3 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />

            <button
              onClick={handleSave}
              disabled={grading || grade === ""}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {grading ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  {submission.status === "graded"
                    ? "Update Grade"
                    : "Return Grade"}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}