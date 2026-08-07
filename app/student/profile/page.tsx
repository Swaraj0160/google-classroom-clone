"use client";

import { useEffect, useState } from "react";
import {
  User,
  Mail,
  GraduationCap,
  Calendar,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

interface Enrollment {
  joined_at: string;
  course: {
    title: string;
    subject: string | null;
    semester: number | null;
    division: string | null;
  }[];
}

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Enrollment[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: enrollments }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single(),

        supabase
          .from("enrollments")
          .select(`
            joined_at,
            course:courses(
              title,
              subject,
              semester,
              division
            )
          `)
          .eq("student_id", user.id),
      ]);

    setProfile(profile);

    setCourses(
      (enrollments as unknown as Enrollment[]) ?? []
    );

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2
          className="animate-spin text-blue-600"
          size={32}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">

        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10">

          <div className="flex items-center gap-6">

            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-24 w-24 rounded-full border-4 border-white object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white">
                <User size={42} />
              </div>
            )}

            <div>

              <h1 className="text-3xl font-bold text-white">
                {profile?.full_name ?? "Student"}
              </h1>

              <p className="mt-2 text-white/90">
                {profile?.role?.toUpperCase()}
              </p>

            </div>

          </div>

        </div>

        <div className="grid gap-8 p-8 lg:grid-cols-2">

          <div className="space-y-5">

            <h2 className="text-xl font-semibold">
              Personal Information
            </h2>

            <div className="flex items-center gap-3">

              <Mail
                className="text-blue-600"
                size={20}
              />

              <div>

                <p className="text-sm text-gray-500">
                  Email
                </p>

                <p className="font-medium">
                  {profile?.email}
                </p>

              </div>

            </div>

          </div>

          <div>

            <h2 className="mb-5 text-xl font-semibold">
              Joined Classes
            </h2>

            {courses.length === 0 ? (
              <p className="text-gray-500">
                No enrolled classes.
              </p>
            ) : (
              <div className="space-y-4">

                {courses.map((course, index) => {
                  const c = course.course?.[0];

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border p-5"
                    >
                      <div className="flex items-center gap-2">

                        <GraduationCap
                          className="text-blue-600"
                          size={18}
                        />

                        <h3 className="font-semibold">
                          {c?.title ?? "-"}
                        </h3>

                      </div>

                      <div className="mt-3 space-y-1 text-sm text-gray-500">

                        <p>
                          {c?.subject ?? "-"}
                        </p>

                        <p>
                          Semester {c?.semester ?? "-"}
                        </p>

                        <p>
                          Division {c?.division ?? "-"}
                        </p>

                      </div>

                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">

                        <Calendar size={14} />

                        Joined{" "}
                        {new Date(
                          course.joined_at
                        ).toLocaleDateString()}

                      </div>

                    </div>
                  );
                })}

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}