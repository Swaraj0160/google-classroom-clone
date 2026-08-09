"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { FileUploader, LinkAttachmentDraft } from "./FileUploader";
import { ExistingAttachmentsList } from "./ExistingAttachmentsList";
import { ClassworkFormInput, ClassworkItem, Topic } from "@/types/classwork";

interface CreateMaterialModalProps {
  open: boolean;
  courseId: string;
  topics: Topic[];
  initial?: ClassworkItem | null;
  defaultTopicId?: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: ClassworkFormInput) => Promise<void>;
}

export function CreateMaterialModal({
  open,
  courseId,
  topics,
  initial,
  defaultTopicId = null,
  submitting,
  onClose,
  onSubmit,
}: CreateMaterialModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [topicId, setTopicId] = useState<string | null>(initial?.topic_id ?? defaultTopicId);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkAttachmentDraft[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<Set<string>>(new Set());

  const existingAttachments = initial?.attachments ?? [];

  const toggleRemoveAttachment = (id: string) => {
    setRemovedAttachmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onSubmit({
      courseId,
      topicId,
      title,
      description,
      instructions: "",
      dueDate: null,
      dueTime: null,
      totalMarks: null,
      status: "published",
      type: "material",
      files,
      links,
      removedAttachmentIds: [...removedAttachmentIds],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {initial ? "Edit material" : "Create material"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Material title"
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
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

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
              Attachments
            </label>
            <ExistingAttachmentsList
              attachments={existingAttachments}
              removedIds={removedAttachmentIds}
              onToggleRemove={toggleRemoveAttachment}
            />
            <FileUploader files={files} links={links} onFilesChange={setFiles} onLinksChange={setLinks} />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {initial ? "Save changes" : "Post material"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}