"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import StreamTab from "@/components/stream/StreamTab";
import { ClassworkTab } from "@/components/classwork/ClassworkTab";
import PeopleTab from "@/components/class/PeopleTab";
import MarksTab from "@/components/class/MarksTab";
import { showToast } from "@/lib/toast";

type ClassTab = "Stream" | "Classwork" | "People" | "Marks";

const TABS: ClassTab[] = ["Stream", "Classwork", "People", "Marks"];

interface Course {
  id: string;
  faculty_id: string;
  title: string;
  subject: string | null;
  division: string | null;
  semester: number | null;
  join_code: string | null;
}

const BANNER_GRADIENTS = [
  "from-blue-600 via-indigo-600 to-indigo-700",
  "from-emerald-600 via-teal-600 to-cyan-700",
  "from-purple-600 via-fuchsia-600 to-pink-600",
  "from-orange-500 via-amber-500 to-yellow-500",
  "from-rose-600 via-red-600 to-orange-600",
  "from-sky-600 via-cyan-600 to-blue-700",
];

function gradientForCourse(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return BANNER_GRADIENTS[hash % BANNER_GRADIENTS.length];
}

export default function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [activeTab, setActiveTab] = useState<ClassTab>("Stream");

  useEffect(() => {
    let cancelled = false;

    async function fetchCourse() {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("id, faculty_id, title, subject, division, semester, join_code")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setMissing(true);
        setLoading(false);
        return;
      }

      setCourse(data as Course);
      setLoading(false);
    }

    fetchCourse();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    notFound();
  }

  if (loading || !course) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const handleCopyJoinCode = async () => {
    if (!course.join_code) return;
    try {
      await navigator.clipboard.writeText(course.join_code);
      showToast.success("Join code copied");
    } catch {
      showToast.error("Could not copy join code");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div
          className={`relative overflow-hidden bg-gradient-to-br ${gradientForCourse(
            course.id
          )} px-6 py-8 sm:px-8 sm:py-10`}
        >
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-black/10" />
          <div className="relative">
            <h1 className="text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
              {course.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
              {course.subject && <span>{course.subject}</span>}
              {course.division && <span>Division {course.division}</span>}
              {course.semester !== null && <span>Semester {course.semester}</span>}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-3 dark:border-gray-700 sm:px-8">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Class details
          </span>
          {course.join_code && (
            <button
              onClick={handleCopyJoinCode}
              className="flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <Copy size={13} />
              Join code: {course.join_code}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "Stream" && (
          <StreamTab courseId={course.id} facultyId={course.faculty_id} />
        )}
        {activeTab === "Classwork" && (
          <ClassworkTab courseId={course.id} facultyId={course.faculty_id} />
        )}
        {activeTab === "People" && (
          <PeopleTab courseId={course.id} facultyId={course.faculty_id} />
        )}
        {activeTab === "Marks" && <MarksTab courseId={course.id} courseName={course.title} />}
      </div>
    </div>
  );
}
