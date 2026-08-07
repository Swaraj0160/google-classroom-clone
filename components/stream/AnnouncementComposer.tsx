"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Pin, Send, X } from "lucide-react";
import { showToast } from "@/lib/toast";

interface ComposerSubmitInput {
  content: string;
  isPinned: boolean;
  files: File[];
}

interface AnnouncementComposerProps {
  submitting: boolean;
  onSubmit: (input: ComposerSubmitInput) => Promise<void>;
}

export default function AnnouncementComposer({
  submitting,
  onSubmit,
}: AnnouncementComposerProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(e.target.files ?? []);

    setFiles((prev) => [...prev, ...selected]);

    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      showToast.error("Write something before posting.");
      return;
    }

    try {
      await onSubmit({
        content: content.trim(),
        isPinned: pinned,
        files,
      });

      setContent("");
      setPinned(false);
      setFiles([]);
      setOpen(false);
    } catch {
      // Error handled inside hook
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30">
          <Send size={16} />
        </span>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          Share an announcement with your class...
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <textarea
        autoFocus
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Announce something to your class..."
        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            >
              {file.name}

              <button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.zip,.mp4"
            onChange={handleFileSelect}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Paperclip size={17} />
          </button>

          <button
            onClick={() => setPinned((p) => !p)}
            title="Pin announcement"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              pinned
                ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            <Pin size={17} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOpen(false);
              setContent("");
              setPinned(false);
              setFiles([]);
            }}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <Loader2 size={15} className="animate-spin" />
            )}

            Post
          </button>
        </div>
      </div>
    </div>
  );
}