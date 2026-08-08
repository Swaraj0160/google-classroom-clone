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
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) return;

    // Classes
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("faculty_id", user.id);

    const courseIds = (courses ?? []).map((c) => c.id);

    if (courseIds.length === 0) {
      setStats({ classes: 0, students: 0, assignments: 0, average: 0 });
      return;
    }

    // Assignments across this faculty's classes
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, total_marks")
      .in("course_id", courseIds);

    // Distinct students enrolled across this faculty's classes
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("student_id")
      .in("course_id", courseIds);
    const distinctStudents = new Set((enrollments ?? []).map((e) => e.student_id));

    // Average % of graded submissions for this faculty's assignments
    const assignmentList = assignments ?? [];
    const assignmentIds = assignmentList.map((a) => a.id);
    const totalMarksById = new Map(assignmentList.map((a) => [a.id, a.total_marks]));
    let average = 0;

    if (assignmentIds.length > 0) {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("marks, assignment_id")
        .in("assignment_id", assignmentIds)
        .eq("status", "graded")
        .not("marks", "is", null);

      const percentages = (submissions ?? [])
        .map((s) => {
          const total = totalMarksById.get(s.assignment_id);
          return total ? (Number(s.marks) / total) * 100 : null;
        })
        .filter((p): p is number => p !== null);

      if (percentages.length > 0) {
        average = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
      }
    }

    setStats({
      classes: courses?.length ?? 0,
      students: distinctStudents.size,
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