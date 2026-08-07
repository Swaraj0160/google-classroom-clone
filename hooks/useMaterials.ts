"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { uploadCourseFile, deleteCourseFile } from "@/lib/storage";
import { detectLinkKind } from "@/lib/classwork";
import { ClassworkFormInput, ClassworkItem } from "@/types/classwork";

const ITEM_SELECT = `
  id, course_id, topic_id, title, description, instructions, due_date, total_marks, status, type, created_at, updated_at,
  attachments:assignment_attachments ( id, assignment_id, kind, file_name, file_path, file_type, file_size, url, created_at )
`;

interface UseMaterialsResult {
  materials: ClassworkItem[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  refresh: () => Promise<void>;
  createMaterial: (input: ClassworkFormInput) => Promise<void>;
  updateMaterial: (id: string, input: ClassworkFormInput) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  moveToTopic: (id: string, topicId: string | null) => Promise<void>;
}

export function useMaterials(courseId: string): UseMaterialsResult {
  const [materials, setMaterials] = useState<ClassworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("assignments")
        .select(ITEM_SELECT)
        .eq("course_id", courseId)
        .eq("type", "material")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setMaterials((data ?? []) as unknown as ClassworkItem[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load materials";
      setError(message);
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchMaterials();
  }, [courseId, fetchMaterials]);

  const uploadAttachments = useCallback(async (materialId: string, input: ClassworkFormInput) => {
    const fileUploads = input.files.length
      ? await Promise.all(
          input.files.map((file) =>
            uploadCourseFile(input.courseId, `materials/${materialId}`, file)
          )
        )
      : [];

    const rows = [
      ...fileUploads.map((f) => ({
        assignment_id: materialId,
        kind: "file" as const,
        file_name: f.name,
        file_path: f.path,
        file_type: f.type,
        file_size: f.size,
        url: null,
      })),
      ...input.links.map((l) => ({
        assignment_id: materialId,
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

  const createMaterial = useCallback(
    async (input: ClassworkFormInput) => {
      setSubmitting(true);
      try {
        const { data, error: insertError } = await supabase
          .from("assignments")
          .insert({
            course_id: input.courseId,
            topic_id: input.topicId,
            title: input.title.trim(),
            description: input.description.trim() || null,
            instructions: null,
            due_date: null,
            total_marks: null,
            status: "published",
            type: "material",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        await uploadAttachments(data.id, input);

        showToast.success("Material posted");
        await fetchMaterials();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to create material");
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchMaterials, uploadAttachments]
  );

  const updateMaterial = useCallback(
    async (id: string, input: ClassworkFormInput) => {
      setSubmitting(true);
      try {
        const { error: updateError } = await supabase
          .from("assignments")
          .update({
            topic_id: input.topicId,
            title: input.title.trim(),
            description: input.description.trim() || null,
          })
          .eq("id", id);

        if (updateError) throw updateError;

        await uploadAttachments(id, input);

        showToast.success("Material updated");
        await fetchMaterials();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to update material");
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchMaterials, uploadAttachments]
  );

  const deleteMaterial = useCallback(
    async (id: string) => {
      try {
        const target = materials.find((m) => m.id === id);
        const paths = (target?.attachments ?? [])
          .map((a) => a.file_path)
          .filter((p): p is string => !!p);

        const { error: deleteError } = await supabase.from("assignments").delete().eq("id", id);
        if (deleteError) throw deleteError;

        if (paths.length > 0) {
          await Promise.all(paths.map((p) => deleteCourseFile(p).catch(() => undefined)));
        }

        setMaterials((prev) => prev.filter((m) => m.id !== id));
        showToast.success("Material deleted");
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to delete material");
      }
    },
    [materials]
  );

  const moveToTopic = useCallback(async (id: string, topicId: string | null) => {
    try {
      const { error: updateError } = await supabase
        .from("assignments")
        .update({ topic_id: topicId })
        .eq("id", id);
      if (updateError) throw updateError;
      setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, topic_id: topicId } : m)));
      showToast.success("Moved");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to move material");
    }
  }, []);

  return {
    materials,
    loading,
    error,
    submitting,
    refresh: fetchMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    moveToTopic,
  };
}