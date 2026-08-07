"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FileUploader, LinkAttachmentDraft } from "./FileUploader";
import {
  ClassworkFormInput,
  ClassworkItem,
  ClassworkStatus,
  ClassworkType,
  Topic,
} from "@/types/classwork";
import { splitDueDateTime } from "@/lib/classwork";

interface AssignmentFormProps {
  courseId: string;
  type: Extract<ClassworkType, "assignment" | "quiz">;
  topics: Topic[];
  initial?: ClassworkItem | null;
  defaultTopicId?: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: ClassworkFormInput) => Promise<void>;
}

export function AssignmentForm({
  courseId,
  type,
  topics,
  initial,
  defaultTopicId = null,
  submitting,
  onCancel,
  onSubmit,
}: AssignmentFormProps) {
  const initialDue = splitDueDateTime(initial?.due_date ?? null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [topicId, setTopicId] = useState<string | null>(initial?.topic_id ?? defaultTopicId);
  const [totalMarks, setTotalMarks] = useState<string>(
    initial?.total_marks !== null && initial?.total_marks !== undefined
      ? String(initial.total_marks)
      : ""
  );
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkAttachmentDraft[]>([]);

  const existingAttachments = initial?.attachments ?? [];

  const buildInput = (status: ClassworkStatus): ClassworkFormInput => ({
    courseId,
    topicId,
    title,
    description,
    instructions,
    dueDate: dueDate || null,
    dueTime: dueTime || null,
    totalMarks: totalMarks.trim() === "" ? null : Number(totalMarks),
    status,
    type,
    files,
    links,
  });

  const handleSubmit = async (status: ClassworkStatus) => {
    if (!title.trim()) return;
    await onSubmit(buildInput(status));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "quiz" ? "Quiz title" : "Assignment title"}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Give students a short overview..."
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
          Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Detailed instructions for completing this work..."
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Topic
          </label>
          <select
            value={topicId ?? ""}
            onChange={(e) => setTopicId(e.target.value || null)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">No topic</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Points
          </label>
          <input
            type="number"
            min={0}
            value={totalMarks}
            onChange={(e) => setTotalMarks(e.target.value)}
            placeholder="100"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Due time
          </label>
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={!dueDate}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
          Attachments
        </label>
        {existingAttachments.length > 0 && (
          <p className="mb-2 text-[11px] text-gray-400">
            {existingAttachments.length} existing attachment
            {existingAttachments.length === 1 ? "" : "s"} will be kept. New files/links are added
            below.
          </p>
        )}
        <FileUploader files={files} links={links} onFilesChange={setFiles} onLinksChange={setLinks} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit("draft")}
          disabled={submitting || !title.trim()}
          className="flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Save draft
        </button>
        <button
          onClick={() => handleSubmit("published")}
          disabled={submitting || !title.trim()}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {initial ? "Save & publish" : "Publish"}
        </button>
      </div>
    </div>
  );
}