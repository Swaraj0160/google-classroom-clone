"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

interface CreateTopicModalProps {
  open: boolean;
  initialTitle?: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

export function CreateTopicModal({
  open,
  initialTitle = "",
  submitting,
  onClose,
  onSubmit,
}: CreateTopicModalProps) {
  const [title, setTitle] = useState(initialTitle);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onSubmit(title.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {initialTitle ? "Rename topic" : "Create topic"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Topic name"
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />

        <div className="mt-5 flex justify-end gap-2">
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
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}