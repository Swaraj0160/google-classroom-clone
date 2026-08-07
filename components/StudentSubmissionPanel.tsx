"use client";

import { Loader2, CalendarDays, CheckCircle2 } from "lucide-react";

import { useStudentSubmission } from "@/hooks/useStudentSubmission";
import { FileUploadZone } from "@/components/FileUploadZone";
import { SubmissionFileList } from "@/components/SubmissionFileList";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";

interface StudentSubmissionPanelProps {
  assignmentId: string;
  studentId: string;
}

export function StudentSubmissionPanel({
  assignmentId,
  studentId,
}: StudentSubmissionPanelProps) {
  const {
    assignment,
    submission,
    loading,
    uploading,
    submitting,
    isPastDue,
    addFiles,
    removeFile,
    submit,
    unsubmit,
  } = useStudentSubmission(assignmentId, studentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading your submission...
      </div>
    );
  }

  if (!submission) return null;

  const editable =
    submission.status === "pending";

  const submitted =
    submission.status === "submitted" ||
    submission.status === "late";

  const graded =
    submission.status === "graded";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Your Work
          </h2>

          {assignment?.due_date && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <CalendarDays size={16} />
              Due{" "}
              {new Date(
                assignment.due_date
              ).toLocaleString()}
            </div>
          )}
        </div>

        <SubmissionStatusBadge
          status={submission.status}
        />
      </div>

      {graded && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
              <CheckCircle2 size={18} />
              Grade Returned
            </div>

            <div className="text-lg font-bold text-green-700 dark:text-green-400">
              {submission.grade ?? "-"}
              {assignment?.total_marks
                ? ` / ${assignment.total_marks}`
                : ""}
            </div>
          </div>

          {submission.feedback && (
            <div className="mt-4 whitespace-pre-wrap text-sm text-green-700 dark:text-green-300">
              {submission.feedback}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <SubmissionFileList
          files={submission.files}
          removable={editable}
          onRemove={removeFile}
        />
      </div>

      {editable && (
        <div className="mt-6">
          <FileUploadZone
            onFilesSelected={addFiles}
            uploading={uploading}
            disabled={uploading}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {editable && (
          <button
            onClick={submit}
            disabled={
              submitting ||
              submission.files.length === 0
            }
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Submitting...
              </span>
            ) : (
              "Turn In"
            )}
          </button>
        )}

        {submitted && !graded && !isPastDue && (
          <button
            onClick={unsubmit}
            disabled={submitting}
            className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Processing...
              </span>
            ) : (
              "Unsubmit"
            )}
          </button>
        )}

        {submitted && isPastDue && (
          <p className="text-sm text-red-500">
            Due date has passed. You can no longer unsubmit.
          </p>
        )}
      </div>
    </div>
  );
}