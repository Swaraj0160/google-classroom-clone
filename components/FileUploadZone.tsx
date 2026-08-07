"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2, FilePlus2 } from "lucide-react";

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
  multiple?: boolean;
  accept?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; //100MB

export function FileUploadZone({
  onFilesSelected,
  disabled = false,
  uploading = false,
  multiple = true,
  accept,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;

      const files = Array.from(fileList);

      const valid = files.filter((file) => file.size <= MAX_FILE_SIZE);

      if (!valid.length) return;

      onFilesSelected(valid);
    },
    [onFilesSelected]
  );

  return (
    <div
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);

        if (!disabled) {
          handleFiles(e.dataTransfer.files);
        }
      }}
      className={`
        group relative overflow-hidden rounded-2xl border-2 border-dashed
        p-8 transition-all duration-300 cursor-pointer
        ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
        }
        ${disabled ? "pointer-events-none opacity-50" : ""}
      `}
    >
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-blue-100 p-4 text-blue-600 transition-transform group-hover:scale-105 dark:bg-blue-900/40 dark:text-blue-400">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <UploadCloud className="h-8 w-8" />
          )}
        </div>

        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {uploading
            ? "Uploading files..."
            : "Drag & Drop files here"}
        </h3>

        <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          or{" "}
          <span className="font-medium text-blue-600 dark:text-blue-400">
            browse your computer
          </span>
        </p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <FilePlus2 size={14} />
          PDF • DOCX • PPT • ZIP • Images • Videos
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Maximum file size: 100 MB
        </p>
      </div>
    </div>
  );
}