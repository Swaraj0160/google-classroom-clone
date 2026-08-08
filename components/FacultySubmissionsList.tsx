"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  Paperclip,
  Search,
  CheckCircle2,
} from "lucide-react";

import { useAssignmentSubmissions } from "@/hooks/useAssignmentSubmissions";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import { compareByRollNumber } from "@/lib/format";
import type { SubmissionWithStudent } from "@/types/submission";

interface FacultySubmissionsListProps {
  assignmentId: string;
  selectedSubmissionId?: string | null;
  onSelect: (submission: SubmissionWithStudent) => void;
}

export function FacultySubmissionsList({
  assignmentId,
  selectedSubmissionId,
  onSelect,
}: FacultySubmissionsListProps) {
  const { submissions, counts, loading } =
    useAssignmentSubmissions(assignmentId);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const value = search.toLowerCase();

    return submissions
      .filter((s) => {
        const name = s.student?.full_name ?? "";
        const email = s.student?.email ?? "";

        return (
          name.toLowerCase().includes(value) ||
          email.toLowerCase().includes(value)
        );
      })
      .sort((a, b) => compareByRollNumber(a.student ?? {}, b.student ?? {}));
  }, [search, submissions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading submissions...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 p-5 dark:border-gray-700">
        <div className="relative">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span>{counts.total} Students</span>
          <span>{counts.submitted} Submitted</span>
          <span>{counts.pending} Pending</span>
          <span>{counts.late} Late</span>
          <span>{counts.graded} Graded</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No students found.
          </div>
        ) : (
          filtered.map((submission) => (
            <button
              key={submission.id}
              onClick={() => onSelect(submission)}
              className={`flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                selectedSubmissionId === submission.id
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {(submission.student?.full_name ??
                    submission.student?.email ??
                    "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium text-gray-900 dark:text-white">
                    {submission.student?.full_name ??
                      submission.student?.email}
                    {submission.student?.roll_number && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {submission.student.roll_number}
                      </span>
                    )}
                  </p>

                  {submission.files.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Paperclip size={13} />
                      {submission.files.length} attachment
                      {submission.files.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {submission.status === "graded" && (
                  <div className="flex items-center gap-2 font-semibold text-green-600">
                    <CheckCircle2 size={16} />
                    {submission.marks ?? "-"}
                  </div>
                )}

                <SubmissionStatusBadge
                  status={submission.status}
                />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}