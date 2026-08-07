"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { Topic } from "@/types/classwork";

interface UseTopicsResult {
  topics: Topic[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTopic: (title: string) => Promise<void>;
  renameTopic: (id: string, title: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  moveTopic: (id: string, direction: "up" | "down") => Promise<void>;
}

export function useTopics(courseId: string): UseTopicsResult {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("topics")
        .select("id, course_id, title, position, created_at, updated_at")
        .eq("course_id", courseId)
        .order("position", { ascending: true });

      if (fetchError) throw fetchError;
      setTopics((data ?? []) as Topic[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load topics";
      setError(message);
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchTopics();
  }, [courseId, fetchTopics]);

  const createTopic = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      try {
        const nextPosition = topics.length
          ? Math.max(...topics.map((t) => t.position)) + 1
          : 0;

        const { data, error: insertError } = await supabase
          .from("topics")
          .insert({ course_id: courseId, title: trimmed, position: nextPosition })
          .select("id, course_id, title, position, created_at, updated_at")
          .single();

        if (insertError) throw insertError;
        setTopics((prev) => [...prev, data as Topic]);
        showToast.success("Topic created");
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to create topic");
        throw err;
      }
    },
    [courseId, topics]
  );

  const renameTopic = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const { error: updateError } = await supabase
        .from("topics")
        .update({ title: trimmed })
        .eq("id", id);
      if (updateError) throw updateError;
      setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
      showToast.success("Topic renamed");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to rename topic");
      throw err;
    }
  }, []);

  const deleteTopic = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from("topics").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setTopics((prev) => prev.filter((t) => t.id !== id));
      showToast.success("Topic deleted");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to delete topic");
      throw err;
    }
  }, []);

  const moveTopic = useCallback(
    async (id: string, direction: "up" | "down") => {
      const sorted = [...topics].sort((a, b) => a.position - b.position);
      const index = sorted.findIndex((t) => t.id === id);
      if (index === -1) return;
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return;

      const current = sorted[index];
      const swapWith = sorted[swapIndex];

      const optimistic = topics.map((t) => {
        if (t.id === current.id) return { ...t, position: swapWith.position };
        if (t.id === swapWith.id) return { ...t, position: current.position };
        return t;
      });
      setTopics(optimistic);

      try {
        const { error: e1 } = await supabase
          .from("topics")
          .update({ position: swapWith.position })
          .eq("id", current.id);
        if (e1) throw e1;

        const { error: e2 } = await supabase
          .from("topics")
          .update({ position: current.position })
          .eq("id", swapWith.id);
        if (e2) throw e2;
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : "Failed to reorder topics");
        await fetchTopics();
      }
    },
    [topics, fetchTopics]
  );

  return {
    topics,
    loading,
    error,
    refresh: fetchTopics,
    createTopic,
    renameTopic,
    deleteTopic,
    moveTopic,
  };
}