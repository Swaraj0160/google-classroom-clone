"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import {
  uploadSubmissionFiles,
  deleteSubmissionFile,
} from "@/lib/submission-storage";
import type { SubmissionWithFiles, AssignmentSummary } from "@/types/submission";

interface UseStudentSubmissionResult {
  submission: SubmissionWithFiles | null;
  assignment: AssignmentSummary | null;
  loading: boolean;
  uploading: boolean;
  submitting: boolean;
  isPastDue: boolean;
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  submit: () => Promise<void>;
  unsubmit: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStudentSubmission(
  assignmentId: string,
  studentId: string | undefined
): UseStudentSubmissionResult {
  const [submission, setSubmission] = useState<SubmissionWithFiles | null>(null);
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchAssignment = useCallback(async () => {
    const { data, error } = await supabase
      .from("assignments")
      .select("id, title, due_date, total_marks, course_id")
      .eq("id", assignmentId)
      .single();

    if (!error && data) setAssignment(data as AssignmentSummary);
  }, [assignmentId]);

  const fetchSubmission = useCallback(async () => {
    if (!studentId) return;

    const { data, error } = await supabase
      .from("submissions")
      .select("*, files:submission_files(*)")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      showToast.error("Failed to load your submission.");
      return;
    }

    if (data) {
      setSubmission(data as SubmissionWithFiles);
    } else {
      // create the pending submission row so files can be attached before submitting
      const { data: created, error: createError } = await supabase
        .from("submissions")
        .insert({
    assignment_id: assignmentId,
    student_id: studentId,
    status: "pending",
    submitted_at: null,
})
        .select("*, files:submission_files(*)")
        .single();

      if (createError) {
        showToast.error("Failed to initialize submission.");
        return;
      }
      setSubmission(created as SubmissionWithFiles);
    }
  }, [assignmentId, studentId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
  await Promise.all([
    fetchAssignment(),
    fetchSubmission(),
  ]);
} finally {
  setLoading(false);
}
  }, [fetchAssignment, fetchSubmission]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`student-submission-${assignmentId}-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `assignment_id=eq.${assignmentId}`,
        },
        (payload) => {
          const row = payload.new as SubmissionWithFiles | undefined;
          if (!row || row.student_id !== studentId) return;

          setSubmission((prev) => {
            if (payload.eventType === "DELETE") return null;
            return { ...(prev ?? { files: [] }), ...row, files: prev?.files ?? [] };
          });
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
          void fetchSubmission();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, studentId, fetchSubmission]);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!submission || !studentId || files.length === 0) return;
      setUploading(true);

      const previousFiles = submission.files;

      try {
        const uploaded = await uploadSubmissionFiles(assignmentId, studentId, files);

        const rows = uploaded.map((u) => ({
          submission_id: submission.id,
          file_name: u.fileName,
          file_path: u.path,
          file_size: u.fileSize,
          file_type: u.fileType,
        }));

        const { data, error } = await supabase
          .from("submission_files")
          .insert(rows)
          .select("*");

        if (error) throw error;

        setSubmission((prev) =>
          prev ? { ...prev, files: [...prev.files, ...(data ?? [])] } : prev
        );
        showToast.success(`${files.length} file(s) attached.`);
      } catch (err) {
        console.error(err);
        setSubmission((prev) => (prev ? { ...prev, files: previousFiles } : prev));
        showToast.error("File upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [submission, studentId, assignmentId]
  );

  const removeFile = useCallback(
    async (fileId: string) => {
      if (!submission) return;
      const file = submission.files.find((f) => f.id === fileId);
      if (!file) return;

      const previousFiles = submission.files;

      setSubmission((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev
      );

      try {
        await deleteSubmissionFile(file.file_path);
        const { error } = await supabase.from("submission_files").delete().eq("id", fileId);
        if (error) throw error;

        showToast.success("File removed.");
      } catch (err) {
        console.error(err);
        setSubmission((prev) => (prev ? { ...prev, files: previousFiles } : prev));
        showToast.error("Failed to remove file.");
      }
    },
    [submission]
  );

  const submit = useCallback(async () => {
  if (!submission) return;

  if (submission.files.length === 0) {
    showToast.error("Attach at least one file before submitting.");
    return;
  }

  if (!studentId) {
    showToast.error("Student account not found.");
    return;
  }

  setSubmitting(true);

  try {
    const now = new Date().toISOString();

    const late =
      assignment?.due_date &&
      new Date(assignment.due_date).getTime() < Date.now();

    const newStatus = late ? "late" : "submitted";

    const { error } = await supabase
      .from("submissions")
      .update({
        status: newStatus,
        submitted_at: now,
      })
      .eq("id", submission.id)
      .eq("student_id", studentId);

    if (error) {
      console.error("SUBMISSION UPDATE ERROR:", error);

      showToast.error(
        error.message || "Failed to submit assignment."
      );

      return;
    }

    await fetchSubmission();

    showToast.success(
      newStatus === "late"
        ? "Assignment submitted late."
        : "Assignment submitted successfully."
    );
  } catch (error) {
    console.error("SUBMISSION ERROR:", error);

    showToast.error("Failed to submit assignment.");
  } finally {
    setSubmitting(false);
  }
}, [
  submission,
  studentId,
  assignment,
  fetchSubmission,
]);
const unsubmit = useCallback(async () => {
  if (!submission || !studentId) return;

  setSubmitting(true);

  try {
    const { error } = await supabase
      .from("submissions")
      .update({
        status: "pending",
        submitted_at: null,
      })
      .eq("id", submission.id)
      .eq("student_id", studentId);

    if (error) {
      console.error("UNSUBMIT ERROR:", error);
      showToast.error(error.message);
      return;
    }

    await fetchSubmission();

    showToast.success("Submission withdrawn.");
  } catch (err) {
    console.error(err);
    showToast.error("Failed to unsubmit.");
  } finally {
    setSubmitting(false);
  }
}, [
  submission,
  studentId,
  fetchSubmission,
]);

  const isPastDue = Boolean(
    assignment?.due_date && new Date(assignment.due_date).getTime() < Date.now()
  );

  return {
    submission,
    assignment,
    loading,
    uploading,
    submitting,
    isPastDue,
    addFiles,
    removeFile,
    submit,
    unsubmit,
    refresh,
  };
}

