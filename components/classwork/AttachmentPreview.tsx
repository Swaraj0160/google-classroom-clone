"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
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

function isPreviewable(type: string | null | undefined) {
  if (!type) return false;
  return (
    type === "application/pdf" ||
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type.startsWith("text/")
  );
}

export function AttachmentPreview({ attachment }: { attachment: AssignmentAttachment }) {
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const Icon = iconFor(attachment);
  const isLink = attachment.kind !== "file";
  const previewable = !isLink && isPreviewable(attachment.file_type);

  const handleOpenLink = () => {
    if (attachment.url) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
    }
  };

  const handlePreview = async () => {
    if (!attachment.file_path) return;
    setPreviewing(true);
    try {
      const url = await getSignedFileUrl(attachment.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Could not open file");
    } finally {
      setPreviewing(false);
    }
  };

  const handleDownload = async () => {
    if (!attachment.file_path) return;
    setDownloading(true);
    try {
      const url = await getSignedFileUrl(attachment.file_path);
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = attachment.file_name ?? "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Could not download file");
    } finally {
      setDownloading(false);
    }
  };

  if (isLink) {
    return (
      <button
        onClick={handleOpenLink}
        className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
            {attachment.file_name ?? attachment.url}
          </span>
          <span className="block text-[11px] text-gray-400">Link</span>
        </span>
        <ExternalLink size={15} className="text-gray-400" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
          {attachment.file_name}
        </span>
        <span className="block text-[11px] text-gray-400">
          {formatFileSize(attachment.file_size ?? 0)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {previewable && (
          <button
            onClick={handlePreview}
            disabled={previewing}
            title="Preview"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:opacity-60 dark:hover:bg-gray-700"
          >
            {previewing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
          </button>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Download"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:opacity-60 dark:hover:bg-gray-700"
        >
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        </button>
      </span>
    </div>
  );
}