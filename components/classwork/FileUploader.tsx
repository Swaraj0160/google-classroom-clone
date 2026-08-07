"use client";

import { useRef, useState } from "react";
import { Link2, Paperclip, X, Youtube } from "lucide-react";
import { ACCEPTED_FILE_TYPES, detectLinkKind } from "@/lib/classwork";
import { formatFileSize } from "@/lib/format";

export interface LinkAttachmentDraft {
  kind: "youtube" | "drive" | "link";
  url: string;
}

interface FileUploaderProps {
  files: File[];
  links: LinkAttachmentDraft[];
  onFilesChange: (files: File[]) => void;
  onLinksChange: (links: LinkAttachmentDraft[]) => void;
}

export function FileUploader({ files, links, onFilesChange, onLinksChange }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkValue, setLinkValue] = useState("");
  const [linkMode, setLinkMode] = useState(false);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    onFilesChange([...files, ...selected]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const addLink = () => {
    const trimmed = linkValue.trim();
    if (!trimmed) return;
    onLinksChange([...links, { kind: detectLinkKind(trimmed), url: trimmed }]);
    setLinkValue("");
    setLinkMode(false);
  };

  const removeLink = (index: number) => {
    onLinksChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleSelect}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Paperclip size={14} /> Attach file
        </button>
        <button
          type="button"
          onClick={() => setLinkMode((m) => !m)}
          className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Link2 size={14} /> Add link
        </button>
      </div>

      {linkMode && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="Paste a YouTube, Drive, or web link..."
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={addLink}
            className="rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      )}

      {(files.length > 0 || links.length > 0) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            >
              <Paperclip size={14} className="shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                  {file.name}
                </p>
                <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {links.map((link, i) => (
            <div
              key={`${link.url}-${i}`}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            >
              {link.kind === "youtube" ? (
                <Youtube size={14} className="shrink-0 text-red-500" />
              ) : (
                <Link2 size={14} className="shrink-0 text-gray-400" />
              )}
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                {link.url}
              </p>
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}