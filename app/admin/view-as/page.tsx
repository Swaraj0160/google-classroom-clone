"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { compareByRollNumber } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import type { SubmissionStatus } from "@/types/submission";

interface Course {
  id: string;
  title: string;
  subject: string | null;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string | null;
  total_marks: number | null;
  course_id: string;
  status: string;
}

interface StudentSubmission {
  id: string;
  assignment_id: string;
  status: SubmissionStatus;
  marks: number | null;
  submitted_at: string | null;
  files?: { id: string; file_name: string }[];
}

interface FacultySubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  marks: number | null;
  submitted_at: string | null;
}

interface StudentPeer {
  id: string;
  full_name: string | null;
  email: string;
  roll_number: string | null;
}

interface ViewedProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  roll_number: string | null;
  created_at: string;
}

interface ViewAsData {
  profile: ViewedProfile;
  courses?: Course[];
  assignments?: Assignment[];
  submissions?: StudentSubmission[] | FacultySubmission[];
  students?: StudentPeer[];
}

export default function ViewAsPage() {
  const router = useRouter();
  const [data, setData] = useState<ViewAsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/view-as/data", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          showToast.error(json.error || "No active View As session.");
          router.replace("/admin/users");
          return;
        }
        setData(json);
      } catch {
        showToast.error("Failed to load View As data.");
        router.replace("/admin/users");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return <p className="text-sm text-ink-faint">Loading…</p>;
  }

  if (!data) return null;

  const { profile } = data;
  const name = profile.full_name || profile.email;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft size={15} /> Back to users
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">{name}</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          <span className="capitalize">{profile.role}</span> · {profile.email} · Roll No:{" "}
          {profile.roll_number?.trim() || "Not set"}
        </p>
      </div>

      {profile.role === "student" && (
        <StudentView
          courses={data.courses ?? []}
          assignments={data.assignments ?? []}
          submissions={(data.submissions ?? []) as StudentSubmission[]}
        />
      )}

      {profile.role === "faculty" && (
        <FacultyView
          courses={data.courses ?? []}
          assignments={data.assignments ?? []}
          students={data.students ?? []}
          submissions={(data.submissions ?? []) as FacultySubmission[]}
        />
      )}

      {profile.role === "admin" && (
        <p className="text-sm text-ink-soft dark:text-gray-400">
          This account has admin access to the same console you&apos;re using now.
        </p>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
      {children}
    </div>
  );
}

function StudentView({
  courses,
  assignments,
  submissions,
}: {
  courses: Course[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
}) {
  const submissionByAssignment = new Map(submissions.map((s) => [s.assignment_id, s]));

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">
          Classes ({courses.length})
        </h2>
        {courses.length === 0 ? (
          <p className="text-sm text-ink-faint">Not enrolled in any classes.</p>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c.id} className="text-sm text-ink-soft dark:text-gray-300">
                {c.title}
                {c.subject ? ` · ${c.subject}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">
          Assignments ({assignments.length})
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-ink-faint">No published assignments.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {assignments.map((a) => {
              const submission = submissionByAssignment.get(a.id);
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-white">{a.title}</p>
                    <p className="text-xs text-ink-faint">
                      Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"} ·{" "}
                      {a.total_marks ?? "—"} marks
                    </p>
                    {submission?.files?.length ? (
                      <p className="mt-1 text-xs text-ink-faint">
                        Files: {submission.files.map((f) => f.file_name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {submission?.marks != null && (
                      <span className="text-sm font-semibold text-ink dark:text-white">
                        {submission.marks}/{a.total_marks ?? "—"}
                      </span>
                    )}
                    <SubmissionStatusBadge status={submission?.status ?? "pending"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function FacultyView({
  courses,
  assignments,
  students,
  submissions,
}: {
  courses: Course[];
  assignments: Assignment[];
  students: StudentPeer[];
  submissions: FacultySubmission[];
}) {
  const sortedStudents = [...students].sort(compareByRollNumber);
  const submissionCountByAssignment = new Map<string, number>();
  for (const s of submissions) {
    submissionCountByAssignment.set(
      s.assignment_id,
      (submissionCountByAssignment.get(s.assignment_id) ?? 0) + 1
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">
          Classes ({courses.length})
        </h2>
        {courses.length === 0 ? (
          <p className="text-sm text-ink-faint">No classes created yet.</p>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c.id} className="text-sm text-ink-soft dark:text-gray-300">
                {c.title}
                {c.subject ? ` · ${c.subject}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">
          Students ({sortedStudents.length})
        </h2>
        {sortedStudents.length === 0 ? (
          <p className="text-sm text-ink-faint">No students enrolled.</p>
        ) : (
          <ul className="space-y-2">
            {sortedStudents.map((s) => (
              <li key={s.id} className="text-sm text-ink-soft dark:text-gray-300">
                {s.full_name || s.email} · Roll No: {s.roll_number?.trim() || "Not set"}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">
          Assignments ({assignments.length})
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-ink-faint">No assignments created yet.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink dark:text-white">{a.title}</p>
                  <p className="text-xs text-ink-faint">
                    Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"} ·{" "}
                    {a.total_marks ?? "—"} marks · {a.status}
                  </p>
                </div>
                <span className="text-sm text-ink-soft dark:text-gray-400">
                  {submissionCountByAssignment.get(a.id) ?? 0} submitted
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
