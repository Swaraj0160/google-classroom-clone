"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClassCard, { type ClassCardStats } from "@/components/dashboard/ClassCard";
import CreateClassModal from "@/components/class/CreateClassModal";
import { Plus, Search } from "lucide-react";

interface Course {
  id: string;
  title: string;
  subject: string;
  semester: number;
  division: string;
  join_code: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Course[]>([]);
  const [statsByCourse, setStatsByCourse] = useState<Record<string, ClassCardStats>>({});
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data, error } = await supabase.from("courses").select("*").eq("faculty_id", user.id);

    if (error) {
      console.error("[classes] failed to load courses:", error.message);
      return;
    }

    const courseList = data ?? [];
    setClasses(courseList);
    await loadStats(courseList);
  }

  // One batched pass across all of this faculty's courses — never one
  // request per card.
  async function loadStats(courseList: Course[]) {
    const courseIds = courseList.map((c) => c.id);
    if (courseIds.length === 0) {
      setStatsByCourse({});
      return;
    }

    const [{ data: enrollments }, { data: assignments }] = await Promise.all([
      supabase.from("enrollments").select("student_id, course_id").in("course_id", courseIds),
      supabase
        .from("assignments")
        .select("id, course_id, total_marks")
        .in("course_id", courseIds)
        .in("type", ["assignment", "quiz"]),
    ]);

    const studentsByCourse = new Map<string, Set<string>>();
    (enrollments ?? []).forEach((e) => {
      const set = studentsByCourse.get(e.course_id) ?? new Set<string>();
      set.add(e.student_id);
      studentsByCourse.set(e.course_id, set);
    });

    const assignmentList = assignments ?? [];
    const assignmentIds = assignmentList.map((a) => a.id);
    const assignmentById = new Map(assignmentList.map((a) => [a.id, a]));
    const assignmentCountByCourse = new Map<string, number>();
    assignmentList.forEach((a) => {
      assignmentCountByCourse.set(a.course_id, (assignmentCountByCourse.get(a.course_id) ?? 0) + 1);
    });

    const pendingByCourse = new Map<string, number>();
    const gradedPercentByCourse = new Map<string, number[]>();

    if (assignmentIds.length > 0) {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("assignment_id, status, marks")
        .in("assignment_id", assignmentIds)
        .neq("status", "pending");

      (submissions ?? []).forEach((s) => {
        const assignment = assignmentById.get(s.assignment_id);
        if (!assignment) return;
        if (s.status === "graded" && s.marks !== null) {
          const total = assignment.total_marks ?? 0;
          if (total > 0) {
            const list = gradedPercentByCourse.get(assignment.course_id) ?? [];
            list.push((Number(s.marks) / total) * 100);
            gradedPercentByCourse.set(assignment.course_id, list);
          }
        } else {
          pendingByCourse.set(assignment.course_id, (pendingByCourse.get(assignment.course_id) ?? 0) + 1);
        }
      });
    }

    const next: Record<string, ClassCardStats> = {};
    courseList.forEach((c) => {
      const percentages = gradedPercentByCourse.get(c.id) ?? [];
      next[c.id] = {
        students: studentsByCourse.get(c.id)?.size ?? 0,
        assignments: assignmentCountByCourse.get(c.id) ?? 0,
        pendingReviews: pendingByCourse.get(c.id) ?? 0,
        average: percentages.length
          ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
          : null,
      };
    });
    setStatsByCourse(next);
  }

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.trim().toLowerCase();
    return classes.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.subject ?? "").toLowerCase().includes(q)
    );
  }, [classes, search]);

  return (
    <div className="animate-fadeInUp space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-white">
            Classes
          </h1>

          <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
            {classes.length} active classes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes..."
              className="rounded-full border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt"
            />
          </div>

          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-blueDark"
          >
            <Plus size={16} />
            Create Class
          </button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-gray-500">
          No classes found.
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-gray-500">
          No classes match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((c) => (
            <ClassCard key={c.id} item={c} stats={statsByCourse[c.id]} />
          ))}
        </div>
      )}

      <CreateClassModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={loadClasses}
      />
    </div>
  );
}
