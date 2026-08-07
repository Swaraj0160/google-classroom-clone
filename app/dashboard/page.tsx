"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Stats {
  classes: number;
  students: number;
  assignments: number;
  average: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    classes: 0,
    students: 0,
    assignments: 0,
    average: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Classes
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("faculty_id", user.id);

    // Assignments
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id");

    // Students
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("student_id");

    // Average Marks
    const { data: submissions } = await supabase
      .from("submissions")
      .select("marks");

    let average = 0;

    if (submissions && submissions.length > 0) {
      average =
        submissions.reduce((sum, s) => sum + (s.marks ?? 0), 0) /
        submissions.length;
    }

    setStats({
      classes: courses?.length ?? 0,
      students: enrollments?.length ?? 0,
      assignments: assignments?.length ?? 0,
      average: Math.round(average),
    });
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">
        Faculty Dashboard 🎉
      </h1>

      <p className="mt-4 text-lg text-gray-600">
        Welcome to the Faculty Classroom Dashboard
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Classes</h2>
          <p className="mt-2 text-3xl font-bold">
            {stats.classes}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Students</h2>
          <p className="mt-2 text-3xl font-bold">
            {stats.students}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Assignments</h2>
          <p className="mt-2 text-3xl font-bold">
            {stats.assignments}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Average Score</h2>
          <p className="mt-2 text-3xl font-bold">
            {stats.average}%
          </p>
        </div>
      </div>
    </div>
  );
}