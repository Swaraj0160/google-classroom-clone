"use client";

import { useState } from "react";
import {
  Download,
  Eye,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  Trash2,
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

function isPreviewable(fileType: string) {
  return (
    fileType === "application/pdf" ||
    fileType.startsWith("image/") ||
    fileType.startsWith("video/") ||
    fileType.startsWith("text/")
  );
}

interface AttachmentChipProps {
  attachment: AnnouncementAttachment;
  onDelete?: (attachment: AnnouncementAttachment) => Promise<void>;
}

export default function AttachmentChip({
  attachment,
  onDelete,
}: AttachmentChipProps) {
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const Icon = iconFor(attachment.file_type);
  const previewable = isPreviewable(attachment.file_type);

  async function handlePreview() {
    setPreviewing(true);
    try {
      const url = await getSignedFileUrl(attachment.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Could not open file"
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await getSignedFileUrl(attachment.file_path);
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Could not download file"
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(attachment);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Could not remove attachment");
    } finally {
      setDeleting(false);
    }
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
          {formatFileSize(attachment.file_size)}
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
            {previewing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Eye size={15} />
            )}
          </button>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Download"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:opacity-60 dark:hover:bg-gray-700"
        >
          {downloading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
        </button>

        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Remove attachment"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-900/20"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        )}
      </span>
    </div>
  );
}