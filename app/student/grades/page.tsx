"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  ClipboardList,
  Award,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface GradeSubmission {
  id: string;
  grade: number | null;
  feedback: string | null;
  status: string;
  graded_at: string | null;

  assignment: {
    id: string;
    title: string;
    total_marks: number | null;
    due_date: string | null;

    course: {
      title: string;
    }[];
  }[];
}

export default function StudentGradesPage() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<GradeSubmission[]>([]);

  useEffect(() => {
    loadGrades();
  }, []);

  async function loadGrades() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("submissions")
      .select(`
        id,
        grade,
        feedback,
        status,
        graded_at,
        assignment:assignments(
          id,
          title,
          total_marks,
          due_date,
          course:courses(
            title
          )
        )
      `)
      .eq("student_id", user.id)
      .eq("status", "graded")
      .order("graded_at", { ascending: false });

    if (error) {
      console.error(error);
      setSubmissions([]);
    } else {
      setSubmissions((data as unknown as GradeSubmission[]) ?? []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2
          size={32}
          className="animate-spin text-blue-600"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Grades
        </h1>

        <p className="mt-2 text-gray-500">
          View your graded assignments.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-2xl border bg-white py-24 text-center shadow-sm">

          <Award
            size={64}
            className="mx-auto mb-5 text-gray-300"
          />

          <h2 className="text-xl font-semibold">
            No Grades Yet
          </h2>

          <p className="mt-2 text-gray-500">
            Your graded assignments will appear here.
          </p>

        </div>
      ) : (
        <div className="space-y-5">

          {submissions.map((submission) => {
            const assignment = submission.assignment?.[0];
            const course = assignment?.course?.[0];

            return (
              <div
                key={submission.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                  <div>

                    <div className="flex items-center gap-2">

                      <ClipboardList
                        size={18}
                        className="text-blue-600"
                      />

                      <h2 className="text-lg font-semibold">
                        {assignment?.title ?? "Assignment"}
                      </h2>

                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                      {course?.title ?? "-"}
                    </p>

                    {assignment?.due_date && (
                      <p className="mt-1 text-xs text-gray-400">
                        Due{" "}
                        {new Date(
                          assignment.due_date
                        ).toLocaleString()}
                      </p>
                    )}

                  </div>

                  <div className="text-right">

                    <div className="flex items-center justify-end gap-2 text-green-600">

                      <CheckCircle2 size={18} />

                      <span className="font-semibold">
                        Graded
                      </span>

                    </div>

                    <div className="mt-2 text-3xl font-bold">

                      {submission.grade ?? "-"}

                      {assignment?.total_marks != null && (
                        <span className="text-lg text-gray-500">
                          {" "}
                          / {assignment.total_marks}
                        </span>
                      )}

                    </div>

                  </div>

                </div>

                {submission.feedback && (
                  <div className="mt-6 rounded-xl bg-gray-50 p-4">

                    <h3 className="mb-2 font-semibold">
                      Faculty Feedback
                    </h3>

                    <p className="whitespace-pre-wrap text-gray-600">
                      {submission.feedback}
                    </p>

                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}