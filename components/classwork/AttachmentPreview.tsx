"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileText,
  Film,
  Loader2,
  Youtube,
} from "lucide-react";
import { AssignmentAttachment } from "@/types/classwork";
import { getSignedFileUrl } from "@/lib/storage";
import { formatFileSize } from "@/lib/format";
import { showToast } from "@/lib/toast";

function iconFor(attachment: AssignmentAttachment) {
  if (attachment.kind === "youtube") return Youtube;
  if (attachment.kind === "drive" || attachment.kind === "link") return ExternalLink;
  const type = attachment.file_type ?? "";
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf") return FileText;
  if (type.includes("zip") || type.includes("rar")) return FileArchive;
  if (type.startsWith("video/")) return Film;
  return FileIcon;
}

export function AttachmentPreview({ attachment }: { attachment: AssignmentAttachment }) {
  const [loading, setLoading] = useState(false);
  const Icon = iconFor(attachment);
  const isLink = attachment.kind !== "file";

  const handleOpen = async () => {
    if (isLink && attachment.url) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!attachment.file_path) return;
    setLoading(true);
    try {
      const url = await getSignedFileUrl(attachment.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Could not open file");
    } finally {
      setLoading(false);
    }
  };

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
          {attachment.file_name ?? attachment.url}
        </span>
        <span className="block text-[11px] text-gray-400">
          {isLink ? "Link" : formatFileSize(attachment.file_size ?? 0)}
        </span>
      </span>
      {loading ? (
        <Loader2 size={15} className="animate-spin text-gray-400" />
      ) : isLink ? (
        <ExternalLink size={15} className="text-gray-400" />
      ) : (
        <Download size={15} className="text-gray-400" />
      )}
    </button>
  );
}