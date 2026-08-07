"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, Clock3, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
      data: { user },
    } = await supabase.auth.getUser();

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