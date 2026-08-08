"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MoreVertical, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compareByRollNumber } from "@/lib/format";

interface PeopleTabProps {
  courseId: string;
  facultyId: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  roll_number?: string | null;
  division?: string | null;
  semester?: string | null;
}

function getInitials(name: string | null | undefined, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InitialsAvatar({
  name,
  email,
  size,
}: {
  name: string | null | undefined;
  email: string;
  size: number;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue dark:bg-brand-blue/20"
    >
      {getInitials(name, email)}
    </div>
  );
}

export default function PeopleTab({ courseId, facultyId }: PeopleTabProps) {
  const [faculty, setFaculty] = useState<UserRow | null>(null);
  const [students, setStudents] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchPeople() {
      setLoading(true);
      setError(null);
      setHiddenCount(0);

      const [facultyRes, enrollmentsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .eq("id", facultyId)
          .maybeSingle(),
        supabase
          .from("enrollments")
          .select("student_id")
          .eq("course_id", courseId),
      ]);

      if (cancelled) return;

      // Faculty profile may legitimately be unavailable (e.g. RLS/deleted account) —
      // never crash the tab over it.
      setFaculty(facultyRes.error ? null : (facultyRes.data as UserRow | null));

      if (enrollmentsRes.error) {
        setError(enrollmentsRes.error.message);
        setLoading(false);
        return;
      }

      const studentIds = [...new Set((enrollmentsRes.data ?? []).map((e) => e.student_id))];

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, roll_number, division, semester")
        .in("id", studentIds);

      if (cancelled) return;

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      const gap = studentIds.length - (profileRows?.length ?? 0);
      if (gap > 0) {
        // Enrollment rows exist but some profile rows didn't come back — this is
        // the signature of an RLS policy blocking cross-user profile reads, not
        // missing data.
        console.warn(
          "[PeopleTab] enrollments resolved more student_ids than profiles returned — likely blocked by profiles RLS policy.",
          { studentIds, resolvedProfileIds: (profileRows ?? []).map((p) => p.id) }
        );
      }
      setHiddenCount(gap);

      setStudents(((profileRows ?? []) as UserRow[]).sort(compareByRollNumber));
      setLoading(false);
    }

    if (courseId && facultyId) {
      fetchPeople();
    }

    return () => {
      cancelled = true;
    };
  }, [courseId, facultyId]);

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Faculty */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Faculty
          </h3>
          <span className="text-xs text-ink-faint">{faculty ? 1 : 0} person</span>
        </div>
        {!faculty && (
          <p className="text-sm text-ink-faint">Faculty information unavailable.</p>
        )}
        {faculty && (
          <div className="flex items-center justify-between rounded-xl p-2 transition-colors hover:bg-surface-alt dark:hover:bg-white/5">
            <div className="flex items-center gap-3">
              <InitialsAvatar name={faculty.full_name} email={faculty.email} size={42} />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink dark:text-white">
                  {faculty.full_name || faculty.email}
                  <ShieldCheck size={14} className="text-brand-blue" />
                </p>
                <p className="text-xs text-ink-faint">{faculty.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Students */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <h3 className="text-base font-semibold text-ink dark:text-white">
            Students
          </h3>
          <span className="text-xs text-ink-faint">{students.length} people</span>
        </div>
        {hiddenCount > 0 && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            {hiddenCount} enrolled student{hiddenCount === 1 ? "" : "s"} could not be displayed —
            their profile is not readable by this account (likely a permissions/RLS
            restriction on the profiles table, not missing data).
          </p>
        )}
        <div className="divide-y divide-black/5 dark:divide-white/10">
          {students.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-surface-alt dark:hover:bg-white/5 sm:px-2 sm:rounded-xl"
            >
              <div className="flex items-center gap-3">
                <InitialsAvatar name={s.full_name} email={s.email} size={40} />
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink dark:text-white">
                    {s.full_name || s.email}
                    {s.roll_number && (
                      <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-ink-faint dark:bg-white/5">
                        Roll {s.roll_number}
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-ink-faint">
                    <Mail size={11} /> {s.email}
                  </p>
                  {(s.division || s.semester) && (
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {s.division ? `Div ${s.division}` : ""}
                      {s.division && s.semester ? " · " : ""}
                      {s.semester ? `Sem ${s.semester}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-alt dark:hover:bg-white/10">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
