"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

export type NotificationType =
  | "submission"
  | "assignment"
  | "grade"
  | "announcement"
  | "enrollment"
  | "deadline";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  href: string;
}

const READ_IDS_KEY = "fc_notification_read_ids";
const LOOKBACK_DAYS = 14;
const MAX_READ_IDS = 500;

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>) {
  try {
    const trimmed = [...ids].slice(-MAX_READ_IDS);
    window.localStorage.setItem(READ_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const items: AppNotification[] = [];

    if (profile.role === "faculty") {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .eq("faculty_id", profile.id);

      const courseIds = (courses ?? []).map((c) => c.id);
      const courseTitleById = new Map((courses ?? []).map((c) => [c.id, c.title]));

      if (courseIds.length > 0) {
        const [{ data: assignments }, { data: enrollments }] = await Promise.all([
          supabase
            .from("assignments")
            .select("id, title, course_id, due_date")
            .in("course_id", courseIds)
            .in("type", ["assignment", "quiz"]),
          supabase
            .from("enrollments")
            .select("student_id, course_id, joined_at")
            .in("course_id", courseIds)
            .gte("joined_at", since),
        ]);

        const assignmentList = assignments ?? [];
        const assignmentIds = assignmentList.map((a) => a.id);
        const assignmentById = new Map(assignmentList.map((a) => [a.id, a]));
        const recentStudentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];

        const [{ data: submissions }, { data: studentProfiles }] = await Promise.all([
          assignmentIds.length > 0
            ? supabase
                .from("submissions")
                .select("id, assignment_id, student_id, status, submitted_at")
                .in("assignment_id", assignmentIds)
                .in("status", ["submitted", "late"])
                .gte("submitted_at", since)
            : Promise.resolve({ data: [] as { id: string; assignment_id: string; student_id: string; status: string; submitted_at: string | null }[] }),
          recentStudentIds.length > 0
            ? supabase.from("profiles").select("id, full_name, email").in("id", recentStudentIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
        ]);

        const studentNameById = new Map(
          (studentProfiles ?? []).map((p) => [p.id, p.full_name || p.email])
        );

        (submissions ?? []).forEach((s) => {
          const a = assignmentById.get(s.assignment_id);
          if (!a || !s.submitted_at) return;
          items.push({
            id: `submission:${s.id}`,
            type: "submission",
            title: s.status === "late" ? "Late submission received" : "New submission received",
            message: `${studentNameById.get(s.student_id) ?? "A student"} submitted "${a.title}"`,
            timestamp: s.submitted_at,
            href: `/dashboard/submissions/${s.id}`,
          });
        });

        (enrollments ?? []).forEach((e) => {
          items.push({
            id: `enrollment:${e.student_id}:${e.course_id}`,
            type: "enrollment",
            title: "New student joined",
            message: `${studentNameById.get(e.student_id) ?? "A student"} joined ${
              courseTitleById.get(e.course_id) ?? "your class"
            }`,
            timestamp: e.joined_at,
            href: `/dashboard/classes/${e.course_id}`,
          });
        });

        const now = Date.now();
        assignmentList.forEach((a) => {
          if (!a.due_date) return;
          const daysUntil = (new Date(a.due_date).getTime() - now) / (24 * 60 * 60 * 1000);
          if (daysUntil > 0 && daysUntil <= 3) {
            items.push({
              id: `deadline:${a.id}`,
              type: "deadline",
              title: "Assignment deadline approaching",
              message: `"${a.title}" is due ${new Date(a.due_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}`,
              timestamp: a.due_date,
              href: `/dashboard/classes/${a.course_id}/assignment/${a.id}`,
            });
          }
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
        const [{ data: assignments }, { data: announcements }, { data: mySubmissions }] =
          await Promise.all([
            supabase
              .from("assignments")
              .select("id, title, course_id, due_date, status, created_at")
              .in("course_id", courseIds)
              .eq("status", "published")
              .in("type", ["assignment", "quiz"]),
            supabase
              .from("announcements")
              .select("id, course_id, content, created_at")
              .in("course_id", courseIds)
              .gte("created_at", since),
            supabase
              .from("submissions")
              .select("id, assignment_id, status, marks, updated_at")
              .eq("student_id", profile.id)
              .eq("status", "graded")
              .gte("updated_at", since),
          ]);

        const assignmentList = assignments ?? [];
        const assignmentById = new Map(assignmentList.map((a) => [a.id, a]));

        assignmentList
          .filter((a) => new Date(a.created_at) >= new Date(since))
          .forEach((a) => {
            items.push({
              id: `assignment:${a.id}`,
              type: "assignment",
              title: "New assignment posted",
              message: `"${a.title}" was posted in ${courseTitleById.get(a.course_id) ?? "your class"}`,
              timestamp: a.created_at,
              href: `/student/classes/${a.course_id}/assignment/${a.id}`,
            });
          });

        (announcements ?? []).forEach((an) => {
          items.push({
            id: `announcement:${an.id}`,
            type: "announcement",
            title: "New class announcement",
            message: an.content.length > 90 ? `${an.content.slice(0, 90)}…` : an.content,
            timestamp: an.created_at,
            href: `/student/classes/${an.course_id}`,
          });
        });

        (mySubmissions ?? []).forEach((s) => {
          const a = assignmentById.get(s.assignment_id);
          items.push({
            id: `grade:${s.id}`,
            type: "grade",
            title: "Assignment graded",
            message: `Your submission for "${a?.title ?? "an assignment"}" was graded${
              s.marks !== null ? `: ${s.marks}` : ""
            }`,
            timestamp: s.updated_at,
            href: `/student/classes/${a?.course_id ?? ""}/assignment/${s.assignment_id}`,
          });
        });

        const now = Date.now();
        const submittedAssignmentIds = new Set((mySubmissions ?? []).map((s) => s.assignment_id));
        assignmentList.forEach((a) => {
          if (!a.due_date || submittedAssignmentIds.has(a.id)) return;
          const daysUntil = (new Date(a.due_date).getTime() - now) / (24 * 60 * 60 * 1000);
          if (daysUntil > 0 && daysUntil <= 2) {
            items.push({
              id: `deadline:${a.id}`,
              type: "deadline",
              title: daysUntil < 1 ? "Assignment due today" : "Assignment deadline approaching",
              message: `"${a.title}" is due ${new Date(a.due_date).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`,
              timestamp: a.due_date,
              href: `/student/classes/${a.course_id}/assignment/${a.id}`,
            });
          }
        });
      }
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(items.slice(0, 30));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      persistReadIds(next);
      return next;
    });
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return {
    notifications,
    unreadCount,
    isRead,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
