"use client";

import { useEffect, useState } from "react";
import {
  User,
  Mail,
  GraduationCap,
  Calendar,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  roll_number: string | null;
  prn: string | null;
  phone: string | null;
  department: string | null;
  semester: string | null;
  division: string | null;
}

interface Enrollment {
  joined_at: string;
  course: {
    title: string;
    subject: string | null;
    semester: number | null;
    division: string | null;
    faculty_id: string;
  } | null;
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name && name.trim()) || email || "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const EDITABLE_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "roll_number", label: "Roll Number" },
  { key: "prn", label: "PRN" },
  { key: "phone", label: "Phone" },
  { key: "department", label: "Department" },
  { key: "semester", label: "Semester" },
  { key: "division", label: "Division" },
];

export default function StudentProfilePage() {
  const { refresh: refreshSharedProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Enrollment[]>([]);
  const [facultyNames, setFacultyNames] = useState<Map<string, string>>(new Map());

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profileData }, { data: enrollments }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, roll_number, prn, phone, department, semester, division")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("enrollments")
        .select(`
          joined_at,
          course:courses(
            title,
            subject,
            semester,
            division,
            faculty_id
          )
        `)
        .eq("student_id", user.id),
    ]);

    setProfile(profileData);

    const enrollmentRows = (enrollments as unknown as Enrollment[]) ?? [];
    setCourses(enrollmentRows);

    const facultyIds = [
      ...new Set(
        enrollmentRows
          .map((e) => e.course?.faculty_id)
          .filter((id): id is string => !!id)
      ),
    ];

    if (facultyIds.length > 0) {
      const { data: facultyRows } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", facultyIds);

      setFacultyNames(
        new Map((facultyRows ?? []).map((f) => [f.id, f.full_name || f.email || "-"]))
      );
    }

    setLoading(false);
  }

  function startEdit() {
    if (!profile) return;
    setForm({
      roll_number: profile.roll_number ?? "",
      prn: profile.prn ?? "",
      phone: profile.phone ?? "",
      department: profile.department ?? "",
      semester: profile.semester ?? "",
      division: profile.division ?? "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        roll_number: form.roll_number || null,
        prn: form.prn || null,
        phone: form.phone || null,
        department: form.department || null,
        semester: form.semester || null,
        division: form.division || null,
      })
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, ...form });
      setEditing(false);
      // Keep the shared profile cache (topbar notifications, dashboard
      // banner) in sync so the roll-number prompt disappears immediately.
      void refreshSharedProfile();
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white/20 text-2xl font-semibold text-white">
              {profile ? getInitials(profile.full_name, profile.email) : <User size={42} />}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {profile?.full_name ?? "Student"}
              </h1>
              <p className="mt-2 text-white/90">{profile?.role?.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-8 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Personal Information</h2>
              {!editing ? (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                >
                  <Pencil size={13} /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Check size={13} /> {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                  >
                    <X size={13} /> Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Mail className="text-blue-600" size={20} />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {EDITABLE_FIELDS.map((f) => (
                <div key={f.key}>
                  <p className="text-sm text-gray-500">{f.label}</p>
                  {editing ? (
                    <input
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  ) : (
                    <p className="font-medium">{(profile?.[f.key] as string) || "-"}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-5 text-xl font-semibold">Joined Classes</h2>

            {courses.length === 0 ? (
              <p className="text-gray-500">No enrolled classes.</p>
            ) : (
              <div className="space-y-4">
                {courses.map((course, index) => {
                  const c = course.course;
                  const facultyName = c?.faculty_id ? facultyNames.get(c.faculty_id) : undefined;

                  return (
                    <div key={index} className="rounded-2xl border p-5">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="text-blue-600" size={18} />
                        <h3 className="font-semibold">{c?.title ?? "-"}</h3>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-gray-500">
                        <p>{c?.subject ?? "-"}</p>
                        <p>Semester {c?.semester ?? "-"}</p>
                        <p>Division {c?.division ?? "-"}</p>
                        <p>Faculty: {facultyName ?? "-"}</p>
                        {profile?.roll_number && <p>Roll Number: {profile.roll_number}</p>}
                        <p className="font-medium text-green-600">Enrolled</p>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                        <Calendar size={14} />
                        Joined {new Date(course.joined_at).toLocaleDateString()}
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