"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { uploadCourseFile, deleteCourseFile, copyCourseFile } from "@/lib/storage";
import { combineDueDateTime, detectLinkKind } from "@/lib/classwork";
import { ClassworkFormInput, ClassworkItem, ClassworkStatus } from "@/types/classwork";

const ITEM_SELECT = `
  id, course_id, topic_id, title, description, instructions, due_date, total_marks, status, type, created_at, updated_at,
  attachments:assignment_attachments ( id, assignment_id, kind, file_name, file_path, file_type, file_size, url, created_at )
`;

interface UseAssignmentsResult {
  assignments: ClassworkItem[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  refresh: () => Promise<void>;
  createAssignment: (input: ClassworkFormInput) => Promise<void>;
  updateAssignment: (id: string, input: ClassworkFormInput) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  setStatus: (id: string, status: ClassworkStatus) => Promise<void>;
  duplicateAssignment: (id: string) => Promise<void>;
  moveToTopic: (id: string, topicId: string | null) => Promise<void>;
}

export function useAssignments(courseId: string): UseAssignmentsResult {
  const [assignments, setAssignments] = useState<ClassworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("assignments")
        .select(ITEM_SELECT)
        .eq("course_id", courseId)
        .in("type", ["assignment", "quiz"])
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setAssignments((data ?? []) as unknown as ClassworkItem[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load assignments";
      setError(message);
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchAssignments();
  }, [courseId, fetchAssignments]);

  const uploadAttachments = useCallback(async (assignmentId: string, input: ClassworkFormInput) => {
    const fileUploads = input.files.length
      ? await Promise.all(
          input.files.map((file) =>
            uploadCourseFile(input.courseId, `assignments/${assignmentId}`, file)
          )
        )
      : [];

    const rows = [
      ...fileUploads.map((f) => ({
        assignment_id: assignmentId,
        kind: "file" as const,
        file_name: f.name,
        file_path: f.path,
        file_type: f.type,
        file_size: f.size,
        url: null,
      })),
      ...input.links.map((l) => ({
        assignment_id: assignmentId,
        kind: detectLinkKind(l.url),
        file_name: null,
        file_path: null,
        file_type: null,
        file_size: null,
        url: l.url,
      })),
    ];

    if (rows.length > 0) {
      const { error: attachError } = await supabase.from("assignment_attachments").insert(rows);
      if (attachError) throw attachError;
    }
  }, []);

  const createAssignment = useCallback(
    async (input: ClassworkFormInput) => {
      setSubmitting(true);
      try {
        const dueIso = combineDueDateTime(input.dueDate, input.dueTime);

        const { data, error: insertError } = await supabase
          .from("assignments")
          .insert({
            course_id: input.courseId,
            topic_id: input.topicId,
            title: input.title.trim(),
            description: input.description.trim() || null,
            instructions: input.instructions.trim() || null,
            due_date: dueIso,
            total_marks: input.totalMarks,
            status: input.status,
            type: input.type,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        await uploadAttachments(data.id, input);

        showToast.success(input.type === "quiz" ? "Quiz created" : "Assignment created");
        await fetchAssignments();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to create assignment");
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchAssignments, uploadAttachments]
  );

  const updateAssignment = useCallback(
    async (id: string, input: ClassworkFormInput) => {
      setSubmitting(true);
      try {
        const dueIso = combineDueDateTime(input.dueDate, input.dueTime);

        const { error: updateError } = await supabase
          .from("assignments")
          .update({
            topic_id: input.topicId,
            title: input.title.trim(),
            description: input.description.trim() || null,
            instructions: input.instructions.trim() || null,
            due_date: dueIso,
            total_marks: input.totalMarks,
            status: input.status,
          })
          .eq("id", id);

        if (updateError) throw updateError;

        if (input.removedAttachmentIds && input.removedAttachmentIds.length > 0) {
          const target = assignments.find((a) => a.id === id);
          const toRemove = (target?.attachments ?? []).filter((a) =>
            input.removedAttachmentIds!.includes(a.id)
          );

          // Delete storage objects first, while the attachment rows still
          // exist — the file API authorizes deletes via that ownership chain.
          await Promise.all(
            toRemove
              .filter((a) => a.file_path)
              .map((a) => deleteCourseFile(a.file_path as string).catch(() => undefined))
          );

          const { error: removeError } = await supabase
            .from("assignment_attachments")
            .delete()
            .in("id", input.removedAttachmentIds);
          if (removeError) throw removeError;
        }

        await uploadAttachments(id, input);

        showToast.success("Assignment updated");
        await fetchAssignments();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to update assignment");
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [assignments, fetchAssignments, uploadAttachments]
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      try {
        const target = assignments.find((a) => a.id === id);
        const paths = (target?.attachments ?? [])
          .map((a) => a.file_path)
          .filter((p): p is string => !!p);

        // Delete storage objects first, while the assignment_attachments rows
        // (and their parent assignment/course) still exist — the file API
        // authorizes deletes by looking up that ownership chain.
        if (paths.length > 0) {
          await Promise.all(paths.map((p) => deleteCourseFile(p).catch(() => undefined)));
        }

        const { error: deleteError } = await supabase.from("assignments").delete().eq("id", id);
        if (deleteError) throw deleteError;

        setAssignments((prev) => prev.filter((a) => a.id !== id));
        showToast.success("Assignment deleted");
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to delete assignment");
      }
    },
    [assignments]
  );

  const setStatus = useCallback(async (id: string, status: ClassworkStatus) => {
    try {
      const { error: updateError } = await supabase
        .from("assignments")
        .update({ status })
        .eq("id", id);
      if (updateError) throw updateError;
      setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      showToast.success(status === "published" ? "Published" : "Moved to draft");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }, []);

  const duplicateAssignment = useCallback(
    async (id: string) => {
      try {
        const source = assignments.find((a) => a.id === id);
        if (!source) throw new Error("Assignment not found");

        const { data: copy, error: insertError } = await supabase
          .from("assignments")
          .insert({
            course_id: source.course_id,
            topic_id: source.topic_id,
            title: `${source.title} (Copy)`,
            description: source.description,
            instructions: source.instructions,
            due_date: source.due_date,
            total_marks: source.total_marks,
            status: "draft",
            type: source.type,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        const fileAttachments = (source.attachments ?? []).filter(
          (a) => a.kind === "file" && a.file_path
        );
        const linkAttachments = (source.attachments ?? []).filter((a) => a.kind !== "file");

        const copiedFileRows = await Promise.all(
          fileAttachments.map(async (a) => {
            const originalPath = a.file_path as string;
            const fileName = a.file_name ?? originalPath.split("/").pop() ?? "file";
            const copied = await copyCourseFile(
              originalPath,
              source.course_id,
              `assignments/${copy.id}`,
              fileName
            );
            return {
              assignment_id: copy.id,
              kind: "file" as const,
              file_name: a.file_name,
              file_path: copied.path,
              file_type: a.file_type,
              file_size: a.file_size,
              url: null,
            };
          })
        );

        const linkRows = linkAttachments.map((a) => ({
          assignment_id: copy.id,
          kind: a.kind,
          file_name: null,
          file_path: null,
          file_type: null,
          file_size: null,
          url: a.url,
        }));

        const allRows = [...copiedFileRows, ...linkRows];
        if (allRows.length > 0) {
          const { error: attachError } = await supabase
            .from("assignment_attachments")
            .insert(allRows);
          if (attachError) throw attachError;
        }

        showToast.success("Duplicated as draft");
        await fetchAssignments();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to duplicate assignment");
      }
    },
    [assignments, fetchAssignments]
  );

  const moveToTopic = useCallback(async (id: string, topicId: string | null) => {
    try {
      const { error: updateError } = await supabase
        .from("assignments")
        .update({ topic_id: topicId })
        .eq("id", id);
      if (updateError) throw updateError;
      setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, topic_id: topicId } : a)));
      showToast.success("Moved");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to move assignment");
    }
  }, []);

  return {
    assignments,
    loading,
    error,
    submitting,
    refresh: fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    setStatus,
    duplicateAssignment,
    moveToTopic,
  };
}