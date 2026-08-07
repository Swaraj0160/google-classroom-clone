"use client";

import { BookOpen, Calendar, ClipboardList, Edit3, FileQuestion, Trash2, X } from "lucide-react";
import { ClassworkItem } from "@/types/classwork";
import { AttachmentPreview } from "./AttachmentPreview";

interface AssignmentDetailsProps {
  item: ClassworkItem | null;
  isFaculty: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return (
    date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

export function AssignmentDetails({ item, isFaculty, onClose, onEdit, onDelete }: AssignmentDetailsProps) {
  if (!item) return null;

  const Icon = item.type === "quiz" ? FileQuestion : item.type === "material" ? BookOpen : ClipboardList;
  const due = formatDueDate(item.due_date);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                item.type === "quiz"
                  ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30"
                  : item.type === "material"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-900/30"
              }`}
            >
              <Icon size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                {due && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Due {due}
                  </span>
                )}
                {item.total_marks !== null && <span>{item.total_marks} points</span>}
                {item.status === "draft" && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    Draft
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
          {item.description && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {item.description}
              </p>
            </div>
          )}

          {item.instructions && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Instructions
              </h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {item.instructions}
              </p>
            </div>
          )}

          {(item.attachments?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Attachments
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {item.attachments!.map((att) => (
                  <AttachmentPreview key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          )}
        </div>

        {isFaculty && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
            <button
              onClick={onDelete}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Edit3 size={14} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}