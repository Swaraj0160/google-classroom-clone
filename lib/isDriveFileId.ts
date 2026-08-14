/**
 * A Google Drive file id never contains "/"; every legacy Supabase Storage
 * path does (e.g. "courseId/scope/filename" or "assignmentId/studentId/filename").
 * This lets old and new files coexist in the same `file_path` column with no
 * schema change, and is the single source of truth for "has this file been
 * migrated to Drive yet" — used by the client hybrid-storage helpers, the
 * server-side file authorization/view routes, and the migration scripts.
 */
export function isDriveFileId(path: string): boolean {
  return !path.includes("/");
}
