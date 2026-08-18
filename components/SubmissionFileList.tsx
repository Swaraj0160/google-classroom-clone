"use client";

import { useState } from "react";
import {
  Download,
  Eye,
  Loader2,
  Trash2,
  FileText,
  FileImage,
  FileArchive,
  FileVideo,
  FileSpreadsheet,
} from "lucide-react";

import type { SubmissionFile } from "@/types/submission";
import {
  downloadSubmissionFile,
  getSubmissionFileUrl,
  formatFileSize,
} from "@/lib/submission-storage";
import { showToast } from "@/lib/toast";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

function isInAppPreviewable(type: string | null) {
  return (
    !!type &&
    (type === "application/pdf" || type.startsWith("image/") || type === DOCX_MIME || type === DOC_MIME)
  );
}

interface SubmissionFileListProps {
  files: SubmissionFile[];
  removable?: boolean;
  onRemove?: (fileId: string) => void;
}

function getIcon(type: string | null) {
  if (!type) return FileText;

  if (type.includes("image")) return FileImage;
  if (type.includes("video")) return FileVideo;
  if (type.includes("sheet") || type.includes("excel"))
    return FileSpreadsheet;
  if (
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("archive")
  )
    return FileArchive;

  return FileText;
}

function isPreviewable(type: string | null) {
  if (!type) return false;
  return (
    type.includes("pdf") ||
    type.includes("image") ||
    type.includes("video") ||
    type.startsWith("text/") ||
    type === DOCX_MIME ||
    type === DOC_MIME
  );
}

export function SubmissionFileList({
  files,
  removable = false,
  onRemove,
}: SubmissionFileListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<SubmissionFile | null>(null);

  if (!files.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
        No files uploaded yet.
      </div>
    );
  }

  async function handlePreview(file: SubmissionFile) {
    if (isInAppPreviewable(file.file_type)) {
      setModalFile(file);
      return;
    }
    try {
      setPreviewingId(file.id);
      const url = await getSubmissionFileUrl(file.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to open file."
      );
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleDownload(file: SubmissionFile) {
    try {
      setDownloadingId(file.id);

      await downloadSubmissionFile(
        file.file_path,
        file.file_name
      );
    } catch (err) {
      showToast.error(
        err instanceof Error
          ? err.message
          : "Failed to download file."
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {files.map((file) => {
        const Icon = getIcon(file.file_type);
        const previewable = isPreviewable(file.file_type);

        return (
          <div
            key={file.id}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Icon size={18} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {file.file_name}
                </p>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(file.file_size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {previewable && (
                <button
                  onClick={() => handlePreview(file)}
                  disabled={previewingId === file.id}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                  title="Preview"
                >
                  {previewingId === file.id ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              )}

              <button
                onClick={() => handleDownload(file)}
                disabled={downloadingId === file.id}
                className="rounded-full p-2 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                title="Download"
              >
                {downloadingId === file.id ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Download size={17} />
                )}
              </button>

              {removable && onRemove && (
                <button
                  onClick={() => onRemove(file.id)}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20"
                  title="Remove"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {modalFile && <FilePreviewModal file={modalFile} onClose={() => setModalFile(null)} />}
    </div>
  );
}