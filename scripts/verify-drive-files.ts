/**
 * Read-only integrity check for every Drive-backed file reference in the DB
 * (submission_files, assignment_attachments, announcement_attachments).
 * For each row whose file_path looks like a Drive file id (no "/" — see
 * lib/isDriveFileId.ts), calls Drive's files.get and reports whether the
 * object actually still exists.
 *
 * This never modifies anything — no DB writes, no Drive writes/deletes. It
 * exists to answer "which records are broken right now" on demand, the same
 * question this was written to answer for Core1/60, Core1/62, Core4/16 on
 * 2026-08-20 (root cause: hooks/useStudentSubmission.ts removeFile() used to
 * delete the Drive object before the DB row, so an interrupted DB delete
 * left a dangling reference to a permanently-deleted file — fixed, but this
 * script is the tool to catch it again, or find any earlier occurrences).
 *
 * Usage:
 *   npm run verify:drive-files
 */
import { loadEnvLocal, requireEnv } from "./migration-env.ts";

loadEnvLocal();
requireEnv([
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
]);

const { getFileMeta, classifyDriveError } = await import("../lib/server/googleDrive.ts");
const { isDriveFileId } = await import("../lib/isDriveFileId.ts");
const { createSupabaseAdminClient } = await import("../lib/server/supabaseAdmin.ts");

interface Row {
  table: "submission_files" | "assignment_attachments" | "announcement_attachments";
  id: string;
  file_path: string;
  file_name: string;
}

async function collectRows(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<Row[]> {
  const rows: Row[] = [];

  const { data: subFiles } = await supabase.from("submission_files").select("id, file_path, file_name");
  for (const r of subFiles ?? []) {
    if (isDriveFileId(r.file_path)) rows.push({ table: "submission_files", ...r });
  }

  const { data: asgAttach } = await supabase
    .from("assignment_attachments")
    .select("id, file_path, file_name");
  for (const r of asgAttach ?? []) {
    if (r.file_path && isDriveFileId(r.file_path)) rows.push({ table: "assignment_attachments", ...r });
  }

  const { data: annAttach } = await supabase
    .from("announcement_attachments")
    .select("id, file_path, file_name");
  for (const r of annAttach ?? []) {
    if (r.file_path && isDriveFileId(r.file_path)) rows.push({ table: "announcement_attachments", ...r });
  }

  return rows;
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const rows = await collectRows(supabase);

  console.log(`\n=== Verifying ${rows.length} Drive-backed file reference(s) ===\n`);

  const counts = { VALID: 0, DRIVE_FILE_NOT_FOUND: 0, DRIVE_AUTH_FAILED: 0, DRIVE_PERMISSION_DENIED: 0, OTHER: 0 };
  const brokenRows: (Row & { category: string })[] = [];
  let consecutiveAuthFailures = 0;

  for (const row of rows) {
    try {
      await getFileMeta(row.file_path);
      counts.VALID++;
      consecutiveAuthFailures = 0;
      continue;
    } catch (err) {
      const category = classifyDriveError(err);
      if (category === "DRIVE_FILE_NOT_FOUND") counts.DRIVE_FILE_NOT_FOUND++;
      else if (category === "DRIVE_AUTH_FAILED") counts.DRIVE_AUTH_FAILED++;
      else if (category === "DRIVE_PERMISSION_DENIED") counts.DRIVE_PERMISSION_DENIED++;
      else counts.OTHER++;
      brokenRows.push({ ...row, category });
      console.log(`  ${category}  ${row.table}:${row.id}  "${row.file_name}"  (${row.file_path})`);

      if (category === "DRIVE_AUTH_FAILED") {
        consecutiveAuthFailures++;
        if (consecutiveAuthFailures >= 3) {
          const remaining = rows.length - (counts.VALID + brokenRows.length);
          console.log(
            `\nStopping early: the last 3 checks all failed with DRIVE_AUTH_FAILED — the Google OAuth ` +
              `refresh token itself is invalid, not these specific files. Checking the remaining ${remaining} ` +
              `row(s) one-by-one would not produce meaningful VALID/BROKEN results until credentials are fixed.`
          );
          counts.DRIVE_AUTH_FAILED += remaining;
          break;
        }
      } else {
        consecutiveAuthFailures = 0;
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ total: rows.length, ...counts }, null, 2));

  if (counts.DRIVE_AUTH_FAILED > 0) {
    console.log(
      "\nDRIVE_AUTH_FAILED means Google Drive credentials are currently invalid (expired/revoked refresh " +
        "token) — this is an infrastructure problem, not evidence these specific files are missing. Re-run " +
        "this script after reconnecting Drive OAuth to get real VALID/BROKEN counts."
    );
  }
  if (counts.DRIVE_FILE_NOT_FOUND > 0) {
    console.log(
      "\nDRIVE_FILE_NOT_FOUND rows point at Drive files that no longer exist. This script makes no changes — " +
        "affected students/faculty should re-upload the file; do not delete these DB rows without confirming " +
        "the underlying work is unrecoverable."
    );
  }
}

main().catch((err) => {
  console.error("verify-drive-files crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
