"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compareByRollNumber } from "@/lib/format";

interface SubmissionMini {
  student_id: string;
  assignment_id: string;
  marks: number | null;
  status: string;
}

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  roll_number: string | null;
  division: string | null;
  semester: string | null;
  joinedAt: string | null;
  coursesCount: number;
  submissionsCount: number;
  average: number | null;
}

const avatarPalette = [
  "bg-brand-blue",
  "bg-brand-green",
  "bg-brand-yellow",
  "bg-brand-purple",
  "bg-brand-red",
  "bg-indigo-500",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

function getAvatarColor(name: string) {
  const sum = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return avatarPalette[sum % avatarPalette.length];
}

export default function StudentsPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: courses } = await supabase
        .from("courses")
        .select("id")
        .eq("faculty_id", user.id);

      const courseIds = (courses ?? []).map((c) => c.id);
      if (courseIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // enrollments and assignments both only depend on courseIds — fetch concurrently.
      const [{ data: enrollments }, { data: assignments }] = await Promise.all([
        supabase
          .from("enrollments")
          .select("student_id, course_id, joined_at")
          .in("course_id", courseIds),
        supabase
          .from("assignments")
          .select("id, course_id, total_marks")
          .in("course_id", courseIds),
      ]);

      const enrollmentRows = enrollments ?? [];
      const studentIds = [...new Set(enrollmentRows.map((e) => e.student_id))];

      const assignmentList = assignments ?? [];
      const assignmentIds = assignmentList.map((a) => a.id);
      const assignmentById = new Map(assignmentList.map((a) => [a.id, a]));

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // profiles (needs studentIds) and submissions (needs assignmentIds + studentIds)
      // don't depend on each other — fetch concurrently.
      const [{ data: profiles, error: profilesError }, { data: submissionsData }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, roll_number, division, semester")
            .in("id", studentIds),
          assignmentIds.length > 0
            ? supabase
                .from("submissions")
                .select("student_id, assignment_id, marks, status")
                .in("assignment_id", assignmentIds)
                .in("student_id", studentIds)
            : Promise.resolve({ data: [] as SubmissionMini[], error: null }),
        ]);

      if (profilesError) {
        console.error("[students] failed to load profiles:", profilesError.message);
      }

      const submissions: SubmissionMini[] = submissionsData ?? [];

      const rows: StudentRow[] = studentIds.map((studentId) => {
        const profileRow = (profiles ?? []).find((p) => p.id === studentId);
        if (!profileRow) {
          console.warn(
            `[students] enrollment references student_id ${studentId} with no matching profiles row.`
          );
        }
        const studentEnrollments = enrollmentRows.filter((e) => e.student_id === studentId);
        const coursesCount = new Set(studentEnrollments.map((e) => e.course_id)).size;
        const earliestJoined = studentEnrollments.reduce<string | null>((earliest, e) => {
          if (!e.joined_at) return earliest;
          if (!earliest) return e.joined_at;
          return new Date(e.joined_at) < new Date(earliest) ? e.joined_at : earliest;
        }, null);

        const studentSubmissions = submissions.filter((s) => s.student_id === studentId);
        const gradedScored = studentSubmissions
          .filter((s) => s.status === "graded" && s.marks !== null)
          .map((s) => {
            const assignment = assignmentById.get(s.assignment_id);
            const total = assignment?.total_marks ?? 0;
            return total > 0 ? (Number(s.marks) / total) * 100 : 0;
          });
        const average = gradedScored.length
          ? Math.round(gradedScored.reduce((sum, p) => sum + p, 0) / gradedScored.length)
          : null;

        return {
          id: studentId,
          full_name: profileRow?.full_name ?? "Unknown Student",
          email: profileRow?.email ?? "",
          roll_number: profileRow?.roll_number ?? null,
          division: profileRow?.division ?? null,
          semester: profileRow?.semester ?? null,
          joinedAt: earliestJoined,
          coursesCount,
          submissionsCount: studentSubmissions.length,
          average,
        };
      });

      rows.sort(compareByRollNumber);

      setStudents(rows);
      setLoading(false);
    };

    load();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.roll_number ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div className="animate-fadeInUp space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-white">Students</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
            {students.length} students across your classes
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="rounded-full border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft dark:text-gray-400">Loading students…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredStudents.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-black/5 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(
                    s.full_name
                  )}`}
                >
                  {getInitials(s.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink dark:text-white">
                    {s.full_name}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-ink-faint">
                    <Mail size={11} /> {s.email}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                {s.roll_number ? (
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 font-medium text-ink-soft dark:bg-white/5 dark:text-gray-300">
                    Roll: {s.roll_number}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    Roll No.: Not set
                  </span>
                )}
                {s.division && (
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 font-medium text-ink-soft dark:bg-white/5 dark:text-gray-300">
                    Div {s.division}
                  </span>
                )}
                {s.semester && (
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 font-medium text-ink-soft dark:bg-white/5 dark:text-gray-300">
                    Sem {s.semester}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-ink-faint">
                  Joined:{" "}
                  {s.joinedAt
                    ? new Date(s.joinedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-brand-blue dark:bg-blue-500/10">
                  {s.coursesCount} {s.coursesCount === 1 ? "class" : "classes"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-surface-alt p-2 dark:bg-white/5">
                  <p className="text-sm font-bold text-ink dark:text-white">{s.submissionsCount}</p>
                  <p className="text-[10px] text-ink-faint">Submissions</p>
                </div>
                <div className="rounded-xl bg-surface-alt p-2 dark:bg-white/5">
                  <p className="text-sm font-bold text-ink dark:text-white">
                    {s.average !== null ? `${s.average}%` : "—"}
                  </p>
                  <p className="text-[10px] text-ink-faint">Average</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}