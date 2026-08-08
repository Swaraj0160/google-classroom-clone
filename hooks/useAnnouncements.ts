"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadCourseFile } from "@/lib/storage";
import { Announcement, NewAnnouncementInput } from "@/lib/types";
import { showToast } from "@/lib/toast";

// Column-name FK hints (profiles!author_id) work as long as author_id has
// exactly one foreign key to profiles — true for both tables here.
const ANNOUNCEMENT_SELECT = `
  id, course_id, author_id, content, is_pinned, created_at, updated_at,
  author:profiles!author_id ( id, full_name, email, role ),
  attachments:announcement_attachments ( id, announcement_id, file_name, file_path, file_type, file_size, created_at ),
  comments:announcement_comments (
    id, announcement_id, author_id, content, created_at,
    author:profiles!author_id ( id, full_name, email, role )
  )
`;

interface UseAnnouncementsResult {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  refresh: () => Promise<void>;
  createAnnouncement: (input: NewAnnouncementInput) => Promise<void>;
  updateAnnouncement: (id: string, content: string) => Promise<void>;
  togglePin: (id: string, isPinned: boolean) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  addComment: (announcementId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string, announcementId: string) => Promise<void>;
}

export function useAnnouncements(courseId: string): UseAnnouncementsResult {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("announcements")
        .select(ANNOUNCEMENT_SELECT)
        .eq("course_id", courseId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setAnnouncements((data ?? []) as unknown as Announcement[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load announcements";
      setError(message);
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchAnnouncements();
  }, [courseId, fetchAnnouncements]);

  const createAnnouncement = useCallback(
    async ({ courseId: cid, content, isPinned = false, files = [] }: NewAnnouncementInput) => {
      setSubmitting(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error("You must be signed in to post.");

        const { data: announcement, error: insertError } = await supabase
          .from("announcements")
          .insert({ course_id: cid, author_id: user.id, content, is_pinned: isPinned })
          .select("id")
          .single();

        if (insertError) throw insertError;

        if (files.length > 0) {
          const uploaded = await Promise.all(
            files.map((file) => uploadCourseFile(cid, `announcements/${announcement.id}`, file))
          );

          const { error: attachError } = await supabase.from("announcement_attachments").insert(
            uploaded.map((f) => ({
              announcement_id: announcement.id,
              file_name: f.name,
              file_path: f.path,
              file_type: f.type,
              file_size: f.size,
            }))
          );
          if (attachError) throw attachError;
        }

        showToast.success("Announcement posted");
        await fetchAnnouncements();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to post announcement");
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchAnnouncements]
  );

  const updateAnnouncement = useCallback(
    async (id: string, content: string) => {
      try {
        const { error: updateError } = await supabase
          .from("announcements")
          .update({ content })
          .eq("id", id);
        if (updateError) throw updateError;
        showToast.success("Announcement updated");
        await fetchAnnouncements();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to update announcement");
        throw err;
      }
    },
    [fetchAnnouncements]
  );

  const togglePin = useCallback(
    async (id: string, isPinned: boolean) => {
      try {
        const { error: updateError } = await supabase
          .from("announcements")
          .update({ is_pinned: isPinned })
          .eq("id", id);
        if (updateError) throw updateError;
        await fetchAnnouncements();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to update pin status");
      }
    },
    [fetchAnnouncements]
  );

  const deleteAnnouncement = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from("announcements").delete().eq("id", id);
      if (deleteError) throw deleteError;
      showToast.success("Announcement deleted");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to delete announcement");
    }
  }, []);

  const addComment = useCallback(
    async (announcementId: string, content: string) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error("You must be signed in to comment.");

        const { error: insertError } = await supabase.from("announcement_comments").insert({
          announcement_id: announcementId,
          author_id: user.id,
          content,
        });
        if (insertError) throw insertError;
        await fetchAnnouncements();
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to add comment");
        throw err;
      }
    },
    [fetchAnnouncements]
  );

  const deleteComment = useCallback(async (commentId: string, announcementId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("announcement_comments")
        .delete()
        .eq("id", commentId);
      if (deleteError) throw deleteError;
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcementId
            ? { ...a, comments: (a.comments ?? []).filter((c) => c.id !== commentId) }
            : a
        )
      );
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to delete comment");
    }
  }, []);

  return {
    announcements,
    loading,
    error,
    submitting,
    refresh: fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    togglePin,
    deleteAnnouncement,
    addComment,
    deleteComment,
  };
}