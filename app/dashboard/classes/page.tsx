"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClassCard from "@/components/dashboard/ClassCard";
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("Logged User:", user);

    if (!user) {
      console.log("No logged in user");
      return;
    }

    console.log("Auth User ID:", user.id);

    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("faculty_id", user.id);

    console.log("Courses:", data);
    console.log("Error:", error);

    if (error) {
      console.error(error);
      return;
    }

    setClasses(data || []);
  }

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
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
  <ClassCard
    key={c.id}
    item={c}
  />
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