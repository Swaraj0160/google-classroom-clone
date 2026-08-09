"use client";

import { Link2, Paperclip, X, Youtube } from "lucide-react";
import type { AssignmentAttachment } from "@/types/classwork";

interface ExistingAttachmentsListProps {
  attachments: AssignmentAttachment[];
  removedIds: Set<string>;
  onToggleRemove: (id: string) => void;
}

export function ExistingAttachmentsList({
  attachments,
  removedIds,
  onToggleRemove,
}: ExistingAttachmentsListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attachments.map((a) => {
        const removed = removedIds.has(a.id);
        const Icon =
          a.kind === "youtube" ? Youtube : a.kind === "drive" || a.kind === "link" ? Link2 : Paperclip;

        return (
          <div
            key={a.id}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
              removed
                ? "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-900/10"
                : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            }`}
          >
            <Icon size={14} className="shrink-0 text-gray-400" />
            <p
              className={`min-w-0 flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-200 ${
                removed ? "text-gray-400 line-through dark:text-gray-500" : ""
              }`}
            >
              {a.file_name ?? a.url ?? "Attachment"}
            </p>
            <button
              type="button"
              onClick={() => onToggleRemove(a.id)}
              title={removed ? "Keep this attachment" : "Remove this attachment"}
              className={
                removed
                  ? "text-[11px] font-medium text-blue-600 hover:underline"
                  : "text-gray-400 hover:text-red-500"
              }
            >
              {removed ? "Undo" : <X size={13} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
