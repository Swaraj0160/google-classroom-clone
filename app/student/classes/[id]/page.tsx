"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import StreamTab from "@/components/stream/StreamTab";
import { ClassworkTab } from "@/components/classwork/ClassworkTab";
import PeopleTab from "@/components/class/PeopleTab";

type ClassTab = "Stream" | "Classwork" | "People";

const TABS: ClassTab[] = ["Stream", "Classwork", "People"];

interface Course {
  id: string;
  faculty_id: string;
  title: string;
  subject: string | null;
  division: string | null;
  semester: number | null;
}

const BANNER_GRADIENTS = [
  "from-blue-600 via-indigo-600 to-indigo-700",
  "from-emerald-600 via-teal-600 to-cyan-700",
  "from-purple-600 via-fuchsia-600 to-pink-600",
  "from-orange-500 via-amber-500 to-yellow-500",
  "from-rose-600 via-red-600 to-orange-600",
  "from-sky-600 via-cyan-600 to-blue-700",
];

function gradientForCourse(id: string) {
  let hash = 0;

  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  return BANNER_GRADIENTS[hash % BANNER_GRADIENTS.length];
}

export default function StudentClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [activeTab, setActiveTab] =
    useState<ClassTab>("Stream");

  useEffect(() => {
    loadCourse();
  }, [id]);

  async function loadCourse() {
    setLoading(true);

    const { data, error } = await supabase
      .from("courses")
      .select(
        "id,faculty_id,title,subject,division,semester"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      setMissing(true);
      return;
    }

    setCourse(data);
    setLoading(false);
  }

  if (missing) notFound();

  if (loading || !course) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2
          size={30}
          className="animate-spin text-blue-600"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">

        <div
          className={`bg-gradient-to-r ${gradientForCourse(
            course.id
          )} px-8 py-10`}
        >
          <h1 className="text-3xl font-bold text-white">
            {course.title}
          </h1>

          <div className="mt-3 flex flex-wrap gap-5 text-sm text-white/90">

            {course.subject && (
              <span>{course.subject}</span>
            )}

            {course.division && (
              <span>
                Division {course.division}
              </span>
            )}

            {course.semester && (
              <span>
                Semester {course.semester}
              </span>
            )}

          </div>
        </div>

        <div className="flex gap-2 border-t px-6">

          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-4 text-sm font-medium ${
                activeTab === tab
                  ? "text-blue-600"
                  : "text-gray-500"
              }`}
            >
              {tab}

              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-blue-600" />
              )}
            </button>
          ))}

        </div>

      </div>

      {activeTab === "Stream" && (
        <StreamTab
          courseId={course.id}
          facultyId={course.faculty_id}
        />
      )}

      {activeTab === "Classwork" && (
        <ClassworkTab
          courseId={course.id}
          facultyId={course.faculty_id}
        />
      )}

      {activeTab === "People" && (
        <PeopleTab
          courseId={course.id}
          facultyId={course.faculty_id}
        />
      )}

    </div>
  );
}