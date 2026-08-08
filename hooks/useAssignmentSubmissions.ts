"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { compareByRollNumber } from "@/lib/format";
import type { SubmissionStudent, SubmissionWithFiles } from "@/types/submission";

export interface RosterEntry {
  student: SubmissionStudent;
  submission: SubmissionWithFiles | null;
}

export interface RosterCounts {
  enrolled: number;
  turnedIn: number;
  missing: number;
}

interface UseAssignmentSubmissionsResult {
  roster: RosterEntry[];
  counts: RosterCounts;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TURNED_IN_STATUSES = new Set(["submitted", "late", "graded"]);

export function useAssignmentSubmissions(
  assignmentId: string,
  courseId: string
): UseAssignmentSubmissionsResult {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // enrollments and submissions are independent (both only need the ids we
    // already have), so fetch concurrently.
    const [
      { data: enrollmentRows, error: enrollError },
      { data: submissionsData, error: submissionsError },
    ] = await Promise.all([
      supabase.from("enrollments").select("student_id").eq("course_id", courseId),
      supabase
        .from("submissions")
        .select("*, files:submission_files(*)")
        .eq("assignment_id", assignmentId),
    ]);

    if (enrollError) showToast.error("Failed to load enrolled students.");
    if (submissionsError) showToast.error("Failed to load submissions.");

    const studentIds = [...new Set((enrollmentRows ?? []).map((e) => e.student_id))];

    let profiles: SubmissionStudent[] = [];
    if (studentIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, roll_number")
        .in("id", studentIds);

      if (profilesError) {
        showToast.error("Failed to load student profiles.");
      } else {
        profiles = (profileRows ?? []) as SubmissionStudent[];
      }

      if (profiles.length < studentIds.length) {
        console.warn(
          "[useAssignmentSubmissions] enrolled student_id(s) with no resolvable profile row",
          studentIds.filter((id) => !profiles.some((p) => p.id === id))
        );
      }
    }

    const submissionByStudent = new Map(
      (submissionsData ?? []).map((s) => [s.student_id as string, s as SubmissionWithFiles])
    );

    const nextRoster: RosterEntry[] = profiles
      .map((student) => ({
        student,
        submission: submissionByStudent.get(student.id) ?? null,
      }))
      .sort((a, b) => compareByRollNumber(a.student, b.student));

    setRoster(nextRoster);
    setLoading(false);
  }, [assignmentId, courseId]);

  useEffect(() => {
    void fetchAll();

    const channel = supabase
      .channel(`assignment-${assignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `assignment_id=eq.${assignmentId}`,
        },
        () => {
          void fetchAll();
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
          void fetchAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, fetchAll]);

  const counts = useMemo<RosterCounts>(() => {
    const turnedIn = roster.filter(
      (r) => r.submission && TURNED_IN_STATUSES.has(r.submission.status)
    ).length;
    return {
      enrolled: roster.length,
      turnedIn,
      missing: roster.length - turnedIn,
    };
  }, [roster]);

  return {
    roster,
    counts,
    loading,
    refresh: fetchAll,
  };
}
