"use client";

import { supabase } from "@/lib/supabase";

export const CLASSROOM_BUCKET = "classroom-files";

// Adjust to your requirements — spec says "configurable".
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export interface UploadedFile {
  path: string;
  name: string;
  type: string;
  size: number;
}

export function assertFileSize(file: File) {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 25MB upload limit.`);
  }
}

/**
 * Uploads a file under <courseId>/<scope>/<timestamp>-<filename>.
 * `scope` examples: "announcements/<announcementId>", "assignments/<assignmentId>", "submissions/<submissionId>"
 */
export async function uploadCourseFile(
  courseId: string,
  scope: string,
  file: File
): Promise<UploadedFile> {
  assertFileSize(file);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${courseId}/${scope}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(CLASSROOM_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  return {
    path,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function getSignedFileUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CLASSROOM_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteCourseFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CLASSROOM_BUCKET).remove([path]);
  if (error) throw error;
}