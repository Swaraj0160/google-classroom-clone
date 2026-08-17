"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import type { SubmissionFile } from "@/types/submission";
import { getSubmissionFileUrl, downloadSubmissionFile } from "@/lib/submission-storage";
import { showToast } from "@/lib/toast";

interface FilePreviewModalProps {
  file: SubmissionFile;
  onClose: () => void;
}

function isImage(type: string | null): boolean {
  return !!type && type.startsWith("image/");
}
function isPdf(type: string | null): boolean {
  return type === "application/pdf";
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewable = isImage(file.file_type) || isPdf(file.file_type);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);

    getSubmissionFileUrl(file.file_path)
      .then(async (resolvedUrl) => {
        if (!previewable) {
          // Nothing is rendered from this URL for non-previewable types —
          // the fallback panel only offers a Download button.
          if (!cancelled) setUrl(resolvedUrl);
          return;
        }

        // Fetch the bytes ourselves rather than pointing <img>/<iframe>
        // straight at the route: a failure (expired Drive credentials,
        // file genuinely missing, etc.) returns a JSON error body which,
        // if used directly as a src, would silently render as a broken
        // image or raw JSON text inside the iframe instead of a real
        // error message.
        const res = await fetch(resolvedUrl);
        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "Could not load this file.");
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this file.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.file_path, previewable]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    try {
      await downloadSubmissionFile(file.file_path, file.file_name);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Download failed.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${file.file_name}`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-surface-darkAlt"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
          <p className="truncate pr-4 text-sm font-medium text-ink dark:text-white">{file.file_name}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              <Download size={14} /> Download
            </button>
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-lg p-1.5 text-ink-faint transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-gray-50 dark:bg-gray-950">
          {error && (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-ink-faint">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
          {!error && !url && <Loader2 className="animate-spin text-ink-faint" size={24} />}
          {!error && url && !previewable && (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-ink-faint">
              <p>Preview isn&apos;t available for this file type.</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white"
              >
                <Download size={14} /> Download to view
              </button>
            </div>
          )}
          {!error && url && isImage(file.file_type) && (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated, short-lived API route, not a static asset
            <img src={url} alt={file.file_name} className="max-h-[75vh] max-w-full object-contain" />
          )}
          {!error && url && isPdf(file.file_type) && (
            <iframe src={url} title={file.file_name} className="h-[75vh] w-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}
