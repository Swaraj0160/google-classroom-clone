"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, Clock3, Bell, IdCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UpcomingAssignments } from "@/components/UpcomingAssignments";
import { useProfile } from "@/hooks/useProfile";

interface Stats {
  classes: number;
  pending: number;
  submitted: number;
}

interface Course {
  id: string;
  title: string;
  subject: string | null;
}

export default function StudentDashboard() {
  const { profile } = useProfile();
  const [stats, setStats] = useState<Stats>({
    classes: 0,
    pending: 0,
    submitted: 0,
  });

  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) return;

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course:courses(id,title,subject)")
      .eq("student_id", user.id);

    const mappedCourses =
      enrollments?.map((e: any) => e.course).filter(Boolean) ?? [];

    setCourses(mappedCourses);

    const courseIds = mappedCourses.map((c: Course) => c.id);

    let pending = 0;
    let submitted = 0;

    if (courseIds.length) {
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id")
        .in("course_id", courseIds)
        .eq("status", "published");

      const assignmentIds = assignments?.map((a) => a.id) ?? [];

      if (assignmentIds.length) {
        const { data: submissions } = await supabase
          .from("submissions")
          .select("assignment_id")
          .eq("student_id", user.id);

        submitted = submissions?.length ?? 0;
        pending = assignmentIds.length - submitted;
      }
    }

    setStats({
      classes: mappedCourses.length,
      pending,
      submitted,
    });
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Student Dashboard
        </h1>

        <p className="mt-2 text-gray-500">
          Welcome back 👋
        </p>
      </div>

      {profile && !profile.roll_number?.trim() && (
        <Link
          href="/student/profile"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
        >
          <div className="flex items-center gap-3">
            <IdCard className="shrink-0 text-amber-600 dark:text-amber-400" size={22} />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Please add your roll number to your profile. Your faculty uses it to organize the
              class roster.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white">
            Add now
          </span>
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-3">

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <BookOpen className="mb-4 text-blue-600" />
          <p className="text-sm text-gray-500">
            My Classes
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            {stats.classes}
          </h2>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <Clock3 className="mb-4 text-orange-500" />
          <p className="text-sm text-gray-500">
            Pending Assignments
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            {stats.pending}
          </h2>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <ClipboardCheck className="mb-4 text-green-600" />
          <p className="text-sm text-gray-500">
            Submitted
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            {stats.submitted}
          </h2>
        </div>

      </div>

      <UpcomingAssignments />

      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <div className="mb-6 flex items-center gap-2">
          <Bell size={18} />
          <h2 className="text-lg font-semibold">
            My Classes
          </h2>
        </div>

        {courses.length === 0 ? (
          <p className="text-gray-500">
            You haven't joined any classes yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/student/classes/${course.id}`}
                className="rounded-xl border p-5 transition hover:shadow-md"
              >
                <h3 className="font-semibold">
                  {course.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  {course.subject}
                </p>
              </Link>
            ))}

          </div>
        )}

      </div>

    </div>
  );
}