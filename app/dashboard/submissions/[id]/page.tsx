"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Clock, AlertCircle, FileCheck, Loader2 } from "lucide-react";
import { SubmissionFileList } from "@/components/SubmissionFileList";
import { AttachmentPreview } from "@/components/classwork/AttachmentPreview";
import type { SubmissionFile } from "@/types/submission";
import type { AssignmentAttachment } from "@/types/classwork";
import {
  calculateSubmissionGrade,
  deriveStatusAfterManualGrade,
  describeSuggestionReason,
  formatLateness,
} from "@/lib/grading";

interface AssignmentRow {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  total_marks: number | null;
}

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  marks: number | null;
  feedback: string | null;
  submitted_at: string | null;
  updated_at?: string;
  /** 'auto' when the mark was set by the on-time/late grading trigger,
   *  'manual' once a faculty member has explicitly saved a grade (which
   *  then permanently takes precedence — the trigger never overwrites a
   *  'manual' row again). Absent on databases that haven't run
   *  scripts/sql/2026-09-02-auto-grading.sql yet. */
  grading_source?: "auto" | "manual" | null;
}

interface StudentRow {
  id: string;
  full_name: string | null;
  email: string;
  roll_number: string | null;
}

export default function SubmissionReviewPage() {
  const params = useParams();
  const submissionId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFile[]>([]);
  const [assignmentAttachments, setAssignmentAttachments] = useState<AssignmentAttachment[]>([]);

  const [marksInput, setMarksInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!submissionId) return;
      setLoading(true);
      setError(null);

      const { data: submissionData, error: submissionError } = await supabase
        .from("submissions")
        .select("id, assignment_id, student_id, status, marks, feedback, submitted_at, updated_at, grading_source")
        .eq("id", submissionId)
        .maybeSingle();

      if (submissionError || !submissionData) {
        setError("Submission not found.");
        setLoading(false);
        return;
      }

      setSubmission(submissionData);
      setMarksInput(submissionData.marks !== null ? String(submissionData.marks) : "");
      setFeedbackInput(submissionData.feedback ?? "");

      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("id, course_id, title, description, instructions, due_date, total_marks")
        .eq("id", submissionData.assignment_id)
        .maybeSingle();

      if (assignmentData) {
        setAssignment(assignmentData);

        // Automatic grading is authoritative for every submission that has not
        // been explicitly graded by faculty. This also repairs older rows that
        // were left at 0 / NULL while the UI only showed a "Suggested grade".
        if (
          submissionData.submitted_at &&
          assignmentData.total_marks !== null &&
          assignmentData.total_marks !== undefined &&
          submissionData.grading_source !== "manual"
        ) {
          const autoGrade = calculateSubmissionGrade({
            dueAt: assignmentData.due_date ?? null,
            submittedAt: submissionData.submitted_at,
            maxMarks: assignmentData.total_marks,
          });

          if (autoGrade.suggestedMarks !== null) {
            const wasLate =
              !!assignmentData.due_date &&
              new Date(submissionData.submitted_at) > new Date(assignmentData.due_date);

            const autoStatus = deriveStatusAfterManualGrade(
              submissionData.status,
              wasLate,
              autoGrade.suggestedMarks
            );

            const needsAutoGrade =
              submissionData.marks !== autoGrade.suggestedMarks ||
              submissionData.grading_source !== "auto" ||
              submissionData.status !== autoStatus;

            if (needsAutoGrade) {
              const { data: autoGradedSubmission, error: autoGradeError } = await supabase
                .from("submissions")
                .update({
                  marks: autoGrade.suggestedMarks,
                  status: autoStatus,
                  grading_source: "auto",
                })
                .eq("id", submissionData.id)
                .select(
                  "id, assignment_id, student_id, status, marks, feedback, submitted_at, updated_at, grading_source"
                )
                .maybeSingle();

              if (autoGradeError || !autoGradedSubmission) {
                console.error("[SubmissionReview] automatic grading failed", autoGradeError);
                setError(
                  "Automatic grading could not be saved. Please verify the database grading setup."
                );
              } else {
                // The database value is now the authoritative value on this page.
                setSubmission(autoGradedSubmission);
                setMarksInput(String(autoGradedSubmission.marks));
                submissionData.marks = autoGradedSubmission.marks;
                submissionData.status = autoGradedSubmission.status;
                submissionData.grading_source = autoGradedSubmission.grading_source;
              }
            } else {
              setMarksInput(String(autoGrade.suggestedMarks));
            }
          }
        }

        const { data: courseData } = await supabase
          .from("courses")
          .select("title")
          .eq("id", assignmentData.course_id)
          .maybeSingle();
        setCourseTitle(courseData?.title ?? null);
      }

      const { data: studentData, error: studentError } = await supabase
        .from("profiles")
        .select("id, full_name, email, roll_number")
        .eq("id", submissionData.student_id)
        .maybeSingle();

      if (!studentData) {
        // submissionData.student_id is valid but no profile row came back —
        // typically an RLS policy blocking cross-user profile reads, not
        // missing data.
        console.warn("[SubmissionReview] profile not returned for student_id", {
          student_id: submissionData.student_id,
          studentError,
        });
      }

      if (studentData) setStudent(studentData);

      const { data: filesData } = await supabase
        .from("submission_files")
        .select("id, submission_id, file_name, file_path, file_type, file_size, created_at")
        .eq("submission_id", submissionData.id);

      setSubmissionFiles((filesData ?? []) as SubmissionFile[]);

      if (assignmentData) {
        const { data: attachmentsData } = await supabase
          .from("assignment_attachments")
          .select("id, assignment_id, kind, file_name, file_path, file_type, file_size, url, created_at")
          .eq("assignment_id", assignmentData.id);

        setAssignmentAttachments((attachmentsData ?? []) as AssignmentAttachment[]);
      }

      setLoading(false);
    };

    load();
  }, [submissionId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const persistGrade = async (marksOverride: number | null, successMessage: string) => {
    if (!submission) return;
    setSaving(true);
    setError(null);

    if (
      marksOverride !== null &&
      assignment?.total_marks !== null &&
      assignment?.total_marks !== undefined &&
      marksOverride > assignment.total_marks
    ) {
      setError(`Marks cannot exceed total marks (${assignment.total_marks}).`);
      setSaving(false);
      return;
    }
    if (marksOverride !== null && marksOverride < 0) {
      setError("Marks cannot be negative.");
      setSaving(false);
      return;
    }

    const wasLate =
      !!submission.submitted_at &&
      !!assignment?.due_date &&
      new Date(submission.submitted_at) > new Date(assignment.due_date);
    const newStatus = deriveStatusAfterManualGrade(submission.status, wasLate, marksOverride);

    const { data, error: updateError } = await supabase
      .from("submissions")
      .update({
        marks: marksOverride,
        feedback: feedbackInput.trim() === "" ? null : feedbackInput,
        status: newStatus,
        // Any explicit save through this UI — typed or "Accept Suggested" —
        // is a faculty decision and permanently takes precedence over the
        // auto-grading trigger. Clearing marks (Return / Needs Revision)
        // resets this so a later resubmission can be auto-graded again.
        grading_source: marksOverride !== null ? "manual" : null,
      })
      .eq("id", submission.id)
      .select("id, assignment_id, student_id, status, marks, feedback, submitted_at, updated_at, grading_source")
      .maybeSingle();

    if (updateError || !data) {
      setError("Failed to save changes.");
      setSaving(false);
      return;
    }

    setSubmission(data);
    setMarksInput(marksOverride !== null ? String(marksOverride) : "");
    setSaving(false);
    setToast(successMessage);
  };

  const handleSave = () => {
    const trimmed = marksInput.trim();
    const parsedMarks = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && Number.isNaN(parsedMarks as number)) {
      setError("Marks must be a valid number.");
      return;
    }
    void persistGrade(parsedMarks, "Changes saved successfully.");
  };

  const handleReturn = () => {
    void persistGrade(null, "Returned for review — no official grade is recorded.");
  };

  // submissions.marks defaults to 0 at the database level (every row starts
  // this way from the initial "pending" insert, before any submission or
  // grading ever happens) — it is never actually NULL in production, so a
  // `marks !== null` check is always true and would show every submission as
  // "graded: 0". submissions.status is the authoritative graded indicator
  // used everywhere else in this app (see hooks/useAssignmentSubmissions.ts,
  // MarksTab.tsx, the student grades page): status only becomes "graded" via
  // an explicit faculty save or the automatic-grading trigger/repair below.
  const isGraded = submission?.status === "graded";

  const scorePercent =
    isGraded && assignment?.total_marks !== null && assignment?.total_marks !== undefined && assignment.total_marks > 0
      ? Math.round((Number(submission?.marks) / assignment.total_marks) * 100)
      : null;
  const { suggestedMarks, timingCategory, lateByMs } = calculateSubmissionGrade({
    dueAt: assignment?.due_date ?? null,
    submittedAt: submission?.submitted_at ?? null,
    maxMarks: assignment?.total_marks ?? null,
  });
  const suggestionReason = describeSuggestionReason(timingCategory, lateByMs);
  const latenessLabel = formatLateness(lateByMs);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-ink-soft dark:text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          Loading submission…
        </div>
      </div>
    );
  }

  if (error && !submission) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-brand-red dark:border-red-500/20 dark:bg-red-500/10">
          <AlertCircle size={16} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp space-y-6">
      {toast && (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-full bg-brand-green px-4 py-2.5 text-sm font-medium text-white shadow-elevated">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">
          {assignment?.title ?? "Assignment"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Reviewing submission from {student?.full_name || student?.email || "Unknown Student"}
          {student?.roll_number ? ` (${student.roll_number})` : ""}
          {courseTitle ? ` · ${courseTitle}` : ""}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-brand-red dark:border-red-500/20 dark:bg-red-500/10">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
              Instructions
            </h3>
            <p className="whitespace-pre-wrap text-sm text-ink-soft dark:text-gray-400">
              {assignment?.instructions ?? "No instructions provided."}
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
              Assignment Attachments
            </h3>
            {assignmentAttachments.length === 0 ? (
              <p className="text-sm text-ink-faint">No attachments.</p>
            ) : (
              <div className="space-y-2">
                {assignmentAttachments.map((f) => (
                  <AttachmentPreview key={f.id} attachment={f} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
              Submitted Files
            </h3>
            <SubmissionFileList files={submissionFiles} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
              Submission Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Student</span>
                <span className="font-medium text-ink dark:text-white">
                  {student?.full_name || student?.email || "Unknown"}
                  {student?.roll_number ? ` · ${student.roll_number}` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Status</span>
                {isGraded && (
                  <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-brand-green dark:bg-green-500/10">
                    <CheckCircle2 size={12} /> Graded
                  </span>
                )}
                {submission?.status === "pending" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600 dark:bg-amber-500/10">
                    <Clock size={12} /> Pending
                  </span>
                )}
                {submission?.status === "submitted" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-brand-blue dark:bg-blue-500/10">
                    <FileCheck size={12} /> Submitted
                  </span>
                )}
                {submission?.status === "late" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-brand-red dark:bg-red-500/10">
                    <AlertCircle size={12} /> Late
                  </span>
                )}
              </div>
              {courseTitle && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Class</span>
                  <span className="font-medium text-ink dark:text-white">{courseTitle}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Submitted</span>
                <span className="font-medium text-ink dark:text-white">
                  {submission?.submitted_at
                    ? new Date(submission.submitted_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Due</span>
                <span className="font-medium text-ink dark:text-white">
                  {assignment?.due_date
                    ? new Date(assignment.due_date).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
              {latenessLabel ? (
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Lateness</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{latenessLabel}</span>
                </div>
              ) : submission?.submitted_at ? (
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Lateness</span>
                  <span className="font-medium text-green-600 dark:text-green-400">Submitted on time</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Total Marks</span>
                <span className="font-medium text-ink dark:text-white">
                  {assignment?.total_marks ?? "—"}
                </span>
              </div>
              {scorePercent !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Score</span>
                  <span className="font-medium text-ink dark:text-white">{scorePercent}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">Grading</h3>

            {isGraded ? (
              <div className="mb-4 rounded-xl bg-green-50 px-3.5 py-3 dark:bg-green-900/20">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Awarded grade: {submission?.marks}
                      {assignment?.total_marks !== null && assignment?.total_marks !== undefined
                        ? ` / ${assignment.total_marks}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
                      {submission?.grading_source === "auto"
                        ? `Automatically graded · ${suggestionReason}`
                        : "Graded by Faculty"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl bg-surface-alt px-3.5 py-2.5 dark:bg-white/5">
                <p className="text-xs text-ink-faint">Grade</p>
                <p className="text-sm font-semibold text-ink dark:text-white">
                  No grade recorded
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-faint">
                  Awarded grade {assignment?.total_marks ? `(out of ${assignment.total_marks})` : ""}
                </label>
                <input
                  type="number"
                  value={marksInput}
                  onChange={(e) => setMarksInput(e.target.value)}
                  placeholder="Enter marks"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-dark"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-faint">
                  Feedback
                </label>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Write feedback for the student..."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-dark"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Saving..." : "Save Grade"}
              </button>
              {isGraded && (
                <button
                  onClick={handleReturn}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-alt disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Return / Needs Revision
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}