// ============================================================================
// STUDENT SUBMISSION UPLOAD LIMITS
// Single source of truth for size/count limits on student assignment
// submissions. Change limits here only.
// ============================================================================

const MB = 1024 * 1024;

export const SUBMISSION_MAX_FILES = 5;
export const SUBMISSION_MAX_TOTAL_BYTES = 30 * MB;
const ABSOLUTE_MAX_FILE_BYTES = 25 * MB;

type FileCategory = "document" | "image" | "archive" | "video" | "other";

const CATEGORY_LIMITS: Record<FileCategory, number> = {
  document: 10 * MB,
  image: 5 * MB,
  archive: 25 * MB,
  video: 25 * MB,
  other: 10 * MB,
};

const CATEGORY_LABELS: Record<FileCategory, string> = {
  document: "PDF/DOC/PPT files",
  image: "Images",
  archive: "ZIP files",
  video: "Videos",
  other: "Files",
};

const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];
const ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z"];
const ARCHIVE_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export function classifyFile(file: File): FileCategory {
  const type = (file.type || "").toLowerCase();
  const ext = getExtension(file.name);

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (ARCHIVE_MIME_TYPES.includes(type) || ARCHIVE_EXTENSIONS.includes(ext)) return "archive";
  if (DOCUMENT_MIME_TYPES.includes(type) || DOCUMENT_EXTENSIONS.includes(ext)) return "document";
  return "other";
}

function formatMb(bytes: number): string {
  const mb = bytes / MB;
  return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

export interface ExistingSubmissionFile {
  file_size: number | null;
}

export interface SubmissionValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates a batch of newly-selected files against a submission's existing
 * files (so count/size limits can't be bypassed by uploading in batches).
 * Purely client-side — no network calls. Returns the first violation found.
 */
export function validateSubmissionFiles(
  existingFiles: ExistingSubmissionFile[],
  newFiles: File[]
): SubmissionValidationResult {
  if (newFiles.length === 0) return { valid: true };

  if (existingFiles.length + newFiles.length > SUBMISSION_MAX_FILES) {
    return {
      valid: false,
      message: `You can upload a maximum of ${SUBMISSION_MAX_FILES} files.`,
    };
  }

  for (const file of newFiles) {
    if (file.size > ABSOLUTE_MAX_FILE_BYTES) {
      return {
        valid: false,
        message: `${file.name} is ${formatMb(file.size)}. No file may exceed ${formatMb(
          ABSOLUTE_MAX_FILE_BYTES
        )}.`,
      };
    }

    const category = classifyFile(file);
    const limit = CATEGORY_LIMITS[category];
    if (file.size > limit) {
      return {
        valid: false,
        message: `${file.name} is ${formatMb(file.size)}. ${CATEGORY_LABELS[category]} must be ${formatMb(
          limit
        )} or smaller.`,
      };
    }
  }

  const existingTotal = existingFiles.reduce((sum, f) => sum + (f.file_size ?? 0), 0);
  const newTotal = newFiles.reduce((sum, f) => sum + f.size, 0);
  const combined = existingTotal + newTotal;

  if (combined > SUBMISSION_MAX_TOTAL_BYTES) {
    return {
      valid: false,
      message: `These files total ${formatMb(combined)}. The maximum submission size is ${formatMb(
        SUBMISSION_MAX_TOTAL_BYTES
      )}.`,
    };
  }

  return { valid: true };
}

export const SUBMISSION_LIMITS_SUMMARY: string[] = [
  `Up to ${SUBMISSION_MAX_FILES} files`,
  `Maximum ${formatMb(SUBMISSION_MAX_TOTAL_BYTES)} total`,
  `PDF/DOC/PPT: ${formatMb(CATEGORY_LIMITS.document)} each`,
  `Images: ${formatMb(CATEGORY_LIMITS.image)} each`,
  `ZIP/projects: ${formatMb(CATEGORY_LIMITS.archive)} each`,
  `Video: ${formatMb(CATEGORY_LIMITS.video)} each`,
];
