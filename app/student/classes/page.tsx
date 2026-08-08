"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";

interface Course {
  id: string;
  title: string;
  subject: string | null;
  division: string | null;
  semester: number | null;
}

const gradients = [
  "from-blue-600 to-indigo-700",
  "from-purple-600 to-pink-600",
  "from-emerald-600 to-cyan-700",
  "from-orange-500 to-red-500",
  "from-sky-600 to-blue-700",
];

function gradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return gradients[hash % gradients.length];
}

export default function StudentClassesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) return;

    const { data } = await supabase
      .from("enrollments")
      .select(
        `
          course:courses(
            id,
            title,
            subject,
            division,
            semester
          )
        `
      )
      .eq("student_id", user.id);

    setCourses(
      (data ?? [])
        .map((e: any) => e.course)
        .filter(Boolean)
    );

    setLoading(false);
  }

  async function joinClass() {
    if (!joinCode.trim()) return;

    setJoining(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) return;

    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("join_code", joinCode.trim())
      .maybeSingle();

    if (!course) {
      showToast.error("Invalid join code");
      setJoining(false);
      return;
    }

    const { error } = await supabase.from("enrollments").insert({
      student_id: user.id,
      course_id: course.id,
    });

    if (error) {
      showToast.error(error.message);
      setJoining(false);
      return;
    }

    showToast.success("Joined class");

    setJoinCode("");

    await loadCourses();

    setJoining(false);
  }

  return (
    <div className="space-y-8">

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold">
            My Classes
          </h1>

          <p className="mt-2 text-gray-500">
            All enrolled classes
          </p>
        </div>

      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h2 className="mb-4 text-lg font-semibold">
          Join a Class
        </h2>

        <div className="flex gap-3">

          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter class code"
            className="flex-1 rounded-xl border px-4 py-3 outline-none focus:border-blue-600"
          />

          <button
            onClick={joinClass}
            disabled={joining}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            Join
          </button>

        </div>

      </div>

      {loading ? (
        <div className="py-16 text-center">
          Loading...
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border bg-white py-20 text-center">

          <BookOpen
            className="mx-auto mb-4 text-gray-300"
            size={60}
          />

          <h2 className="text-xl font-semibold">
            No Classes Yet
          </h2>

          <p className="mt-2 text-gray-500">
            Join your first classroom using the class code.
          </p>

        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/student/classes/${course.id}`}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`h-32 bg-gradient-to-r ${gradient(
                  course.id
                )} p-6 text-white`}
              >
                <h2 className="text-2xl font-bold">
                  {course.title}
                </h2>

                <p className="mt-2 opacity-90">
                  {course.subject}
                </p>
              </div>

              <div className="space-y-1 p-5 text-sm text-gray-500">

                <p>
                  Division : {course.division}
                </p>

                <p>
                  Semester : {course.semester}
                </p>

              </div>
            </Link>
          ))}

        </div>
      )}

    </div>
  );
}