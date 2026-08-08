"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  BookOpen,
  FileQuestion,
  Loader2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { StudentSubmissionPanel } from "@/components/StudentSubmissionPanel";
import { AttachmentPreview } from "@/components/classwork/AttachmentPreview";
import type { ClassworkItem } from "@/types/classwork";

export default function StudentAssignmentPage({
  params,
}: {
  params: Promise<{
    id: string;
    assignmentId: string;
  }>;
}) {
  const { id: courseId, assignmentId } = use(params);

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] =
    useState<ClassworkItem | null>(null);

  const [studentId, setStudentId] =
    useState<string>("");

  useEffect(() => {
    load();
  }, [assignmentId]);

  async function load() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setStudentId(user.id);

    const { data } = await supabase
      .from("assignments")
      .select(
        `
          *,
          attachments:assignment_attachments(*)
        `
      )
      .eq("id", assignmentId)
      .single();

    setAssignment(data as ClassworkItem);

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

  if (!assignment) {
    return (
      <div className="py-24 text-center">
        Assignment not found.
      </div>
    );
  }

  const Icon =
    assignment.type === "quiz"
      ? FileQuestion
      : assignment.type === "material"
      ? BookOpen
      : ClipboardList;

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      <Link
        href={`/student/classes/${courseId}`}
        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft size={16} />
        Back to Class
      </Link>

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">

        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-8">

          <div className="flex items-center gap-4">

            <div className="rounded-2xl bg-white/15 p-4 text-white">
              <Icon size={28} />
            </div>

            <div>

              <h1 className="text-3xl font-bold text-white">
                {assignment.title}
              </h1>

              <div className="mt-3 flex flex-wrap gap-5 text-sm text-white/90">

                {assignment.due_date && (
                  <span className="flex items-center gap-2">
                    <Calendar size={15} />
                    Due{" "}
                    {new Date(
                      assignment.due_date
                    ).toLocaleString()}
                  </span>
                )}

                {assignment.total_marks && (
                  <span>
                    {assignment.total_marks} Points
                  </span>
                )}

              </div>

            </div>

          </div>

        </div>

        <div className="space-y-8 p-8">

          {assignment.description && (
            <div>

              <h2 className="mb-3 text-lg font-semibold">
                Description
              </h2>

              <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {assignment.description}
              </p>

            </div>
          )}

          {assignment.instructions && (
            <div>

              <h2 className="mb-3 text-lg font-semibold">
                Instructions
              </h2>

              <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {assignment.instructions}
              </p>

            </div>
          )}

          {(assignment.attachments?.length ?? 0) > 0 && (

            <div>

              <h2 className="mb-4 text-lg font-semibold">
                Attachments
              </h2>

              <div className="grid gap-3">

                {assignment.attachments!.map((file) => (
                  <AttachmentPreview key={file.id} attachment={file} />
                ))}

              </div>

            </div>

          )}

          <StudentSubmissionPanel
            assignmentId={assignment.id}
            studentId={studentId}
          />

        </div>

      </div>

    </div>
  );
}