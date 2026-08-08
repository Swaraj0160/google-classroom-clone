"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

export interface UpcomingItem {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  dueDate: string;
  href: string;
  overdue: boolean;
  dueToday: boolean;
  completed: boolean;
  missingCount: number | null;
  totalEnrolled: number | null;
}

const WINDOW_PAST_DAYS = 3;
const MAX_ITEMS = 8;

interface UseUpcomingAssignmentsResult {
  items: UpcomingItem[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useUpcomingAssignments(): UseUpcomingAssignmentsResult {
  const { profile } = useProfile();
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const now = Date.now();
    const windowStart = new Date(now - WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const next: UpcomingItem[] = [];

    if (profile.role === "faculty") {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .eq("faculty_id", profile.id);

      const courseIds = (courses ?? []).map((c) => c.id);
      const courseTitleById = new Map((courses ?? []).map((c) => [c.id, c.title]));

      if (courseIds.length > 0) {
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id, title, course_id, due_date")
          .in("course_id", courseIds)
          .in("type", ["assignment", "quiz"])
          .eq("status", "published")
          .not("due_date", "is", null)
          .gte("due_date", windowStart)
          .order("due_date", { ascending: true })
          .limit(MAX_ITEMS);

        const assignmentList = assignments ?? [];
        const assignmentIds = assignmentList.map((a) => a.id);

        const [{ data: enrollments }, { data: submissions }] = await Promise.all([
          supabase.from("enrollments").select("student_id, course_id").in("course_id", courseIds),
          assignmentIds.length > 0
            ? supabase
                .from("submissions")
                .select("assignment_id, status")
                .in("assignment_id", assignmentIds)
                .in("status", ["submitted", "late", "graded"])
            : Promise.resolve({ data: [] as { assignment_id: string; status: string }[] }),
        ]);

        const enrolledCountByCourse = new Map<string, number>();
        (enrollments ?? []).forEach((e) =>
          enrolledCountByCourse.set(e.course_id, (enrolledCountByCourse.get(e.course_id) ?? 0) + 1)
        );
        const turnedInCountByAssignment = new Map<string, number>();
        (submissions ?? []).forEach((s) =>
          turnedInCountByAssignment.set(
            s.assignment_id,
            (turnedInCountByAssignment.get(s.assignment_id) ?? 0) + 1
          )
        );

        assignmentList.forEach((a) => {
          const dueDate = a.due_date as string;
          const dueMs = new Date(dueDate).getTime();
          const totalEnrolled = enrolledCountByCourse.get(a.course_id) ?? 0;
          const turnedIn = turnedInCountByAssignment.get(a.id) ?? 0;
          const missing = Math.max(0, totalEnrolled - turnedIn);
          next.push({
            id: a.id,
            title: a.title,
            courseId: a.course_id,
            courseTitle: courseTitleById.get(a.course_id) ?? "",
            dueDate,
            href: `/dashboard/classes/${a.course_id}/assignment/${a.id}`,
            overdue: dueMs < now,
            dueToday: new Date(dueMs).toDateString() === new Date(now).toDateString(),
            completed: missing === 0,
            missingCount: missing,
            totalEnrolled,
          });
        });
      }
    } else if (profile.role === "student") {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id, course:courses(id, title)")
        .eq("student_id", profile.id);

      const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id))];
      const courseTitleById = new Map(
        (enrollments ?? []).map((e) => [
          e.course_id,
          (e.course as unknown as { title: string } | null)?.title,
        ])
      );

      if (courseIds.length > 0) {
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id, title, course_id, due_date")
          .in("course_id", courseIds)
          .in("type", ["assignment", "quiz"])
          .eq("status", "published")
          .not("due_date", "is", null)
          .gte("due_date", windowStart)
          .order("due_date", { ascending: true })
          .limit(MAX_ITEMS);

        const assignmentList = assignments ?? [];
        const assignmentIds = assignmentList.map((a) => a.id);

        const { data: mySubmissions } =
          assignmentIds.length > 0
            ? await supabase
                .from("submissions")
                .select("assignment_id, status")
                .eq("student_id", profile.id)
                .in("assignment_id", assignmentIds)
                .in("status", ["submitted", "late", "graded"])
            : { data: [] as { assignment_id: string; status: string }[] };

        const submittedIds = new Set((mySubmissions ?? []).map((s) => s.assignment_id));

        assignmentList.forEach((a) => {
          const dueDate = a.due_date as string;
          const dueMs = new Date(dueDate).getTime();
          const completed = submittedIds.has(a.id);
          next.push({
            id: a.id,
            title: a.title,
            courseId: a.course_id,
            courseTitle: courseTitleById.get(a.course_id) ?? "",
            dueDate,
            href: `/student/classes/${a.course_id}/assignment/${a.id}`,
            overdue: dueMs < now && !completed,
            dueToday: new Date(dueMs).toDateString() === new Date(now).toDateString(),
            completed,
            missingCount: null,
            totalEnrolled: null,
          });
        });
      }
    }

    next.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setItems(next);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  return { items, loading, refresh: fetchItems };
}
