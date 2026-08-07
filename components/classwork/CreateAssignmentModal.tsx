"use client";

import { X } from "lucide-react";
import { AssignmentForm } from "./AssignmentForm";
import { ClassworkFormInput, ClassworkItem, ClassworkType, Topic } from "@/types/classwork";

interface CreateAssignmentModalProps {
  open: boolean;
  courseId: string;
  type: Extract<ClassworkType, "assignment" | "quiz">;
  topics: Topic[];
  initial?: ClassworkItem | null;
  defaultTopicId?: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: ClassworkFormInput) => Promise<void>;
}

export function CreateAssignmentModal({
  open,
  courseId,
  type,
  topics,
  initial,
  defaultTopicId,
  submitting,
  onClose,
  onSubmit,
}: CreateAssignmentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {initial ? "Edit" : "Create"} {type === "quiz" ? "quiz assignment" : "assignment"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <AssignmentForm
            courseId={courseId}
            type={type}
            topics={topics}
            initial={initial}
            defaultTopicId={defaultTopicId}
            submitting={submitting}
            onCancel={onClose}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}