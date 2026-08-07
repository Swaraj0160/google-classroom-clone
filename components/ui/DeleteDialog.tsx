"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteDialog({ open, title, description, onCancel, onConfirm }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30">
            <AlertTriangle size={20} />
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}