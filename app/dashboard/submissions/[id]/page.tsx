"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSignedFileUrl } from "@/lib/storage";
import { getSubmissionFileUrl } from "@/lib/submission-storage";
import { FileText, Download, CheckCircle2, Clock, AlertCircle, FileCheck, Loader2 } from "lucide-react";

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
}

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
}

interface SubmissionFileRow {
  id: string;
  file_name: string;
  file_path: string;
}

interface AttachmentRow {
  id: string;
  file_name: string;
  file_path: string | null;
  url: string | null;
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
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFileRow[]>([]);
  const [assignmentAttachments, setAssignmentAttachments] = useState<AttachmentRow[]>([]);

  const [marksInput, setMarksInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!submissionId) return;
      setLoading(true);
      setError(null);

      const { data: submissionData, error: submissionError } = await supabase
        .from("submissions")
        .select("id, assignment_id, student_id, status, marks, feedback, submitted_at")
        .eq("id", submissionId)
        .single();

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
        .single();

      if (assignmentData) setAssignment(assignmentData);

      const { data: studentData } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("id", submissionData.student_id)
        .single();

      if (studentData) setStudent(studentData);

      const { data: filesData } = await supabase
        .from("submission_files")
        .select("id, file_name, file_path")
        .eq("submission_id", submissionData.id);

      setSubmissionFiles(filesData ?? []);

      if (assignmentData) {
        const { data: attachmentsData } = await supabase
          .from("assignment_attachments")
          .select("id, file_name, file_path, url")
          .eq("assignment_id", assignmentData.id);

        setAssignmentAttachments(attachmentsData ?? []);
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

  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    setError(null);

    const parsedMarks = marksInput.trim() === "" ? null : Number(marksInput);

    if (parsedMarks !== null && Number.isNaN(parsedMarks)) {
      setError("Marks must be a valid number.");
      setSaving(false);
      return;
    }

    if (
      parsedMarks !== null &&
      assignment?.total_marks !== null &&
      assignment?.total_marks !== undefined &&
      parsedMarks > assignment.total_marks
    ) {
      setError(`Marks cannot exceed total marks (${assignment.total_marks}).`);
      setSaving(false);
      return;
    }

    const newStatus = parsedMarks !== null ? "graded" : submission.status;

    const { data, error: updateError } = await supabase
      .from("submissions")
      .update({
        marks: parsedMarks,
        feedback: feedbackInput.trim() === "" ? null : feedbackInput,
        status: newStatus,
      })
      .eq("id", submission.id)
      .select("id, assignment_id, student_id, status, marks, feedback, submitted_at")
      .single();

    if (updateError || !data) {
      setError("Failed to save changes.");
      setSaving(false);
      return;
    }

    setSubmission(data);
    setSaving(false);
    setToast("Changes saved successfully.");
  };

  const scorePercent =
    submission?.marks !== null &&
    submission?.marks !== undefined &&
    assignment?.total_marks
      ? Math.round((Number(submission.marks) / assignment.total_marks) * 100)
      : null;

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
          Reviewing submission from {student?.full_name ?? "Unknown Student"}
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
  <button
    key={f.id}
    type="button"
    onClick={async () => {
      try {
        const href = f.url ?? (f.file_path ? await getSignedFileUrl(f.file_path) : null);
        if (!href) throw new Error("File unavailable");
        window.open(href, "_blank", "noopener,noreferrer");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open file.");
      }
    }}
    className="flex w-full items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-alt dark:border-white/10 dark:hover:bg-white/5"
  >
                    <span className="flex items-center gap-2 truncate text-ink dark:text-white">
                      <FileText size={15} className="shrink-0 text-ink-faint" />
                      <span className="truncate">{f.file_name}</span>
                    </span>
                    <Download size={15} className="shrink-0 text-ink-faint" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
              Submitted Files
            </h3>
            {submissionFiles.length === 0 ? (
              <p className="text-sm text-ink-faint">No files submitted.</p>
            ) : (
              <div className="space-y-2">
                {submissionFiles.map((f) => (
  <button
    key={f.id}
    type="button"
    onClick={async () => {
      try {
        const href = await getSubmissionFileUrl(f.file_path);
        window.open(href, "_blank", "noopener,noreferrer");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open file.");
      }
    }}
    className="flex w-full items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-alt dark:border-white/10 dark:hover:bg-white/5"
  >
                    
                    <span className="flex items-center gap-2 truncate text-ink dark:text-white">
                      <FileText size={15} className="shrink-0 text-ink-faint" />
                      <span className="truncate">{f.file_name}</span>
                    </span>
                    <Download size={15} className="shrink-0 text-ink-faint" />
                  </button>
                ))}
              </div>
            )}
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
                  {student?.full_name ?? "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Status</span>
                {submission?.status === "graded" && (
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
            <h3 className="mb-3 text-sm font-semibold text-ink dark:text-white">
              Grade Submission
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-faint">
                  Marks {assignment?.total_marks ? `(out of ${assignment.total_marks})` : ""}
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
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}