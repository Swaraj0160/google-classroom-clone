"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { StudentSubmissionPanel } from "@/components/StudentSubmissionPanel";
import { FacultySubmissionsList } from "@/components/FacultySubmissionsList";
import { GradingPanel } from "@/components/GradingPanel";
import { useAssignmentSubmissions } from "@/hooks/useAssignmentSubmissions";
import type { SubmissionWithStudent } from "@/types/submission";
import { Calendar, ClipboardList, Loader2, Paperclip } from "lucide-react";

interface AssignmentDetail {
  id: string;
  course_id: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  total_marks: number | null;
  status: "draft" | "published";
  type: "assignment" | "quiz" | "material";
  created_at: string;
  updated_at: string;
}

interface AssignmentAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
}

type UserRole = "faculty" | "student";

export default function AssignmentDetailsPage() {
  const params = useParams<{ id: string; assignmentId: string }>();

  const [userId, setUserId] = useState<string | undefined>();
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(true);

  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithStudent | null>(
    null
  );

  useEffect(() => {
    async function loadUserAndRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setRoleLoading(false);
        return;
      }
      setUserId(uid);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();

      if (error) {
        showToast.error("Failed to determine user role.");
      } else {
        setRole(profile?.role as UserRole);
      }
      setRoleLoading(false);
    }

    loadUserAndRole();
  }, []);

  useEffect(() => {
    async function loadAssignment() {
      setAssignmentLoading(true);

      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, course_id, topic_id, title, description, instructions, due_date, total_marks, status, type, created_at, updated_at"
        )
        .eq("id", params.assignmentId)
        .single();

      if (error) {
        showToast.error("Failed to load assignment.");
      } else {
        setAssignment(data as AssignmentDetail);
      }

      // Adjust table/column names below if your attachments module uses a
      // different structure — this assumes an `assignment_attachments` table.
      const { data: files, error: filesError } = await supabase
        .from("assignment_attachments")
        .select("id, file_name, file_path, file_size, file_type")
        .eq("assignment_id", params.assignmentId);

      if (!filesError && files) {
        setAttachments(files as AssignmentAttachment[]);
      }

      setAssignmentLoading(false);
    }

    loadAssignment();
  }, [params.assignmentId]);

 

  

  const loading = roleLoading || assignmentLoading;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-400 dark:text-gray-500">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading assignment…
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-400 dark:text-gray-500">
        Assignment not found.
      </div>
    );
  }

  const dueDateLabel = assignment.due_date
    ? new Date(assignment.due_date).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No due date";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <span className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {assignment.type}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              {assignment.title}
            </h1>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 text-sm sm:items-end">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              {dueDateLabel}
            </div>
            {assignment.total_marks !== null && (
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <ClipboardList className="h-4 w-4" />
                {assignment.total_marks} points
              </div>
            )}
          </div>
        </div>

        {assignment.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {assignment.description}
          </p>
        )}

        {assignment.instructions && (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Instructions
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {assignment.instructions}
            </p>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Attachments
            </h3>
            <ul className="space-y-2">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                >
                  <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{file.file_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Role-based submission area */}
      {role === "student" && userId && (
        <StudentSubmissionPanel assignmentId={params.assignmentId} studentId={userId} />
      )}

      {role === "faculty" && userId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
          <FacultySubmissionsList
            assignmentId={params.assignmentId}
            selectedSubmissionId={selectedSubmission?.id}
            onSelect={setSelectedSubmission}
          />

          {selectedSubmission ? (
            <GradingPanel
              submission={selectedSubmission}
              maxPoints={assignment.total_marks}
              facultyId={userId}
              onGraded={() => setSelectedSubmission(null)}
            />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500">
              Select a student to view and grade their submission.
            </div>
          )}
        </div>
      )}

      {!role && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 dark:text-gray-500">
          Unable to determine your role for this assignment.
        </div>
      )}
    </div>
  );
}