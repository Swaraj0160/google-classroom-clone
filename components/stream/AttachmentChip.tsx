"use client";

import { useState } from "react";
import {
  Download,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
} from "lucide-react";

import type { AnnouncementAttachment } from "@/lib/types";
import { getSignedFileUrl } from "@/lib/storage";
import { formatFileSize } from "@/lib/format";
import { showToast } from "@/lib/toast";

function iconFor(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  if (fileType.includes("zip")) return FileArchive;

  return FileIcon;
}

interface AttachmentChipProps {
  attachment: AnnouncementAttachment;
}

export default function AttachmentChip({
  attachment,
}: AttachmentChipProps) {
  const [loading, setLoading] = useState(false);

  const Icon = iconFor(attachment.file_type);

  async function handleOpen() {
    setLoading(true);

    try {
      const url = await getSignedFileUrl(attachment.file_path);

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast.error(
        err instanceof Error
          ? err.message
          : "Could not open file"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
        <Icon size={16} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
          {attachment.file_name}
        </span>

        <span className="block text-[11px] text-gray-400">
          {formatFileSize(attachment.file_size)}
        </span>
      </span>

      {loading ? (
        <Loader2
          size={15}
          className="animate-spin text-gray-400"
        />
      ) : (
        <Download
          size={15}
          className="text-gray-400"
        />
      )}
    </button>
  );
}