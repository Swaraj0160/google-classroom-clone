"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateClassModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [division, setDivision] = useState("");
  const [semester, setSemester] = useState(3);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function generateJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function createClass() {
    if (!title.trim()) {
      showToast.error("Enter class name");
      return;
    }

    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      showToast.error("User not logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("courses").insert([
      {
        faculty_id: user.id,
        title,
        subject,
        division,
        semester,
        join_code: generateJoinCode(),
      },
    ]);

    setLoading(false);

    if (error) {
      console.error(error);
      showToast.error(error.message);
      return;
    }

    showToast.success("Class created");

    setTitle("");
    setSubject("");
    setDivision("");
    setSemester(3);

    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">

      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Create New Classroom
          </h2>

          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="space-y-5">

          <input
            placeholder="Class Name"
            className="w-full rounded-xl border p-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            placeholder="Subject"
            className="w-full rounded-xl border p-3"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <input
            placeholder="Division"
            className="w-full rounded-xl border p-3"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          />

          <select
            className="w-full rounded-xl border p-3"
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
          >
            <option value={1}>Semester 1</option>
            <option value={2}>Semester 2</option>
            <option value={3}>Semester 3</option>
            <option value={4}>Semester 4</option>
            <option value={5}>Semester 5</option>
            <option value={6}>Semester 6</option>
            <option value={7}>Semester 7</option>
            <option value={8}>Semester 8</option>
          </select>

        </div>

        <div className="mt-8 flex justify-end gap-3">

          <button
            onClick={onClose}
            className="rounded-xl border px-5 py-2"
          >
            Cancel
          </button>

          <button
            onClick={createClass}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>

        </div>

      </div>

    </div>
  );
}