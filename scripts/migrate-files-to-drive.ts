/**
 * SAFE-MODE, one-time migration: moves the last legacy Supabase-Storage-backed
 * classroom files (submission_files / assignment_attachments /
 * announcement_attachments) into Google Drive, reusing the app's existing,
 * already-verified Drive service (lib/server/googleDrive.ts) and canonical
 * folder structure (courses/{courseId}/... , submissions/{assignmentId}/{studentId}).
 *
 * This script NEVER deletes the original Supabase Storage object — that is
 * a separate, explicit step (scripts/migrate-files-cleanup.ts). It only:
 *   1. downloads bytes from Supabase Storage,
 *   2. uploads them to Drive via the existing service,
 *   3. verifies the Drive copy (size, name, byte-for-byte hash),
 *   4. only then updates the DB row's file_path to the Drive file id.
 *
 * Resumable & idempotent:
 *   - A row whose file_path already has no "/" is already Drive-backed and
 *     is only re-verified (getFileMeta), never re-uploaded.
 *   - A local ledger (scripts/.migration-state.json, gitignored) records
 *     "uploaded" (Drive file created, DB not yet updated) so a re-run after
 *     a crash resumes from the DB update step instead of uploading a
 *     duplicate Drive file.
 *
 * Usage:
 *   npm run migrate:files -- --dry-run   (default if no flag given)
 *   npm run migrate:files -- --run       (actually uploads + updates DB)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { loadEnvLocal, requireEnv } from "./migration-env.ts";

loadEnvLocal();
requireEnv([
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "GOOGLE_DRIVE_ROOT_FOLDER_ID",
]);

// Reuse the existing, already-verified Drive service and admin client —
// no second Drive implementation, no duplicated OAuth logic.
const { resolveFolderPath, uploadFile, getFileMeta, downloadFileStream } = await import(
  "../lib/server/googleDrive.ts"
);
const { createSupabaseAdminClient } = await import("../lib/server/supabaseAdmin.ts");
const { isDriveFileId } = await import("../lib/isDriveFileId.ts");

const DRY_RUN = !process.argv.includes("--run");
const STATE_PATH = "scripts/.migration-state.json";

type LedgerStatus = "uploaded" | "db_updated" | "failed";
interface LedgerEntry {
  status: LedgerStatus;
  driveFileId?: string;
  bucket?: string;
  originalPath?: string;
  sha256?: string;
  error?: string;
  updatedAt: string;
}
type Ledger = Record<string, LedgerEntry>;

function loadLedger(): Ledger {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveLedger(ledger: Ledger) {
  if (DRY_RUN) return; // never persist state during a dry run
  writeFileSync(STATE_PATH, JSON.stringify(ledger, null, 2));
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

interface MigrationCandidate {
  key: string; // ledger key: "table:rowId"
  table: "submission_files" | "assignment_attachments" | "announcement_attachments";
  rowId: string;
  bucket: "submissions" | "classroom-files";
  originalPath: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  driveFolderSegments: string[];
}

interface Summary {
  eligible: number;
  alreadyDriveVerifiedOk: number;
  alreadyDriveVerifiedFailed: number;
  migratedThisRun: number;
  resumedFromLedger: number;
  skippedDryRun: number;
  failed: number;
  failures: { key: string; error: string }[];
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const ledger = loadLedger();

  console.log(`\n=== Migrate Files to Drive — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE RUN"} ===\n`);

  // ---- Gather candidates from all three tables, with authoritative DB context ----
  const candidates: MigrationCandidate[] = [];
  const alreadyDrive: { key: string; fileId: string; fileName: string; fileSize: number | null }[] = [];

  // submission_files -> submissions -> assignments (course_id, for context only)
  {
    const { data: files, error } = await supabase
      .from("submission_files")
      .select("id, submission_id, file_name, file_path, file_type, file_size");
    if (error) throw error;

    const submissionIds = [...new Set((files ?? []).map((f) => f.submission_id))];
    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, assignment_id, student_id")
      .in("id", submissionIds.length ? submissionIds : ["00000000-0000-0000-0000-000000000000"]);
    const submissionById = new Map((submissions ?? []).map((s) => [s.id, s]));

    for (const f of files ?? []) {
      if (!f.file_path) continue;
      const key = `submission_files:${f.id}`;
      if (isDriveFileId(f.file_path)) {
        alreadyDrive.push({ key, fileId: f.file_path, fileName: f.file_name, fileSize: f.file_size });
        continue;
      }
      const sub = submissionById.get(f.submission_id);
      if (!sub) {
        console.warn(`  ! skipping ${key}: submission ${f.submission_id} not found (authoritative link missing)`);
        continue;
      }
      candidates.push({
        key,
        table: "submission_files",
        rowId: f.id,
        bucket: "submissions",
        originalPath: f.file_path,
        fileName: f.file_name,
        fileType: f.file_type,
        fileSize: f.file_size,
        // Canonical structure per Phase 3: submissions/{assignmentId}/{studentId}
        driveFolderSegments: ["submissions", sub.assignment_id, sub.student_id],
      });
    }
  }

  // assignment_attachments -> assignments (course_id)
  {
    const { data: rows, error } = await supabase
      .from("assignment_attachments")
      .select("id, assignment_id, kind, file_name, file_path, file_type, file_size")
      .eq("kind", "file");
    if (error) throw error;

    const assignmentIds = [...new Set((rows ?? []).map((r) => r.assignment_id))];
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, course_id")
      .in("id", assignmentIds.length ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);
    const assignmentById = new Map((assignments ?? []).map((a) => [a.id, a]));

    for (const r of rows ?? []) {
      if (!r.file_path) continue;
      const key = `assignment_attachments:${r.id}`;
      if (isDriveFileId(r.file_path)) {
        alreadyDrive.push({ key, fileId: r.file_path, fileName: r.file_name, fileSize: r.file_size });
        continue;
      }
      const assignment = assignmentById.get(r.assignment_id);
      if (!assignment) {
        console.warn(`  ! skipping ${key}: assignment ${r.assignment_id} not found (authoritative link missing)`);
        continue;
      }
      candidates.push({
        key,
        table: "assignment_attachments",
        rowId: r.id,
        bucket: "classroom-files",
        originalPath: r.file_path,
        fileName: r.file_name,
        fileType: r.file_type,
        fileSize: r.file_size,
        // Canonical structure: courses/{courseId}/assignments/{assignmentId}
        driveFolderSegments: ["courses", assignment.course_id, "assignments", r.assignment_id],
      });
    }
  }

  // announcement_attachments -> announcements (course_id)
  {
    const { data: rows, error } = await supabase
      .from("announcement_attachments")
      .select("id, announcement_id, file_name, file_path, file_type, file_size");
    if (error) throw error;

    const announcementIds = [...new Set((rows ?? []).map((r) => r.announcement_id))];
    const { data: announcements } = await supabase
      .from("announcements")
      .select("id, course_id")
      .in("id", announcementIds.length ? announcementIds : ["00000000-0000-0000-0000-000000000000"]);
    const announcementById = new Map((announcements ?? []).map((a) => [a.id, a]));

    for (const r of rows ?? []) {
      if (!r.file_path) continue;
      const key = `announcement_attachments:${r.id}`;
      if (isDriveFileId(r.file_path)) {
        alreadyDrive.push({ key, fileId: r.file_path, fileName: r.file_name, fileSize: r.file_size });
        continue;
      }
      const announcement = announcementById.get(r.announcement_id);
      if (!announcement) {
        console.warn(`  ! skipping ${key}: announcement ${r.announcement_id} not found (authoritative link missing)`);
        continue;
      }
      candidates.push({
        key,
        table: "announcement_attachments",
        rowId: r.id,
        bucket: "classroom-files",
        originalPath: r.file_path,
        fileName: r.file_name,
        fileType: r.file_type,
        fileSize: r.file_size,
        // Canonical structure: courses/{courseId}/announcements/{announcementId}
        driveFolderSegments: ["courses", announcement.course_id, "announcements", r.announcement_id],
      });
    }
  }

  const summary: Summary = {
    eligible: candidates.length,
    alreadyDriveVerifiedOk: 0,
    alreadyDriveVerifiedFailed: 0,
    migratedThisRun: 0,
    resumedFromLedger: 0,
    skippedDryRun: 0,
    failed: 0,
    failures: [],
  };

  // ---- Step A: lightly verify already-Drive rows still resolve in Drive ----
  console.log(`--- Verifying ${alreadyDrive.length} already-Drive row(s) ---`);
  for (const a of alreadyDrive) {
    try {
      const meta = await getFileMeta(a.fileId);
      console.log(`  ok   ${a.key} -> Drive "${meta.name}"`);
      summary.alreadyDriveVerifiedOk++;
    } catch (err) {
      console.error(`  FAIL ${a.key} -> Drive file ${a.fileId} not resolvable:`, (err as Error).message);
      summary.alreadyDriveVerifiedFailed++;
    }
  }

  // ---- Step B: migrate the eligible legacy rows ----
  console.log(`\n--- Migrating ${candidates.length} legacy row(s) ---`);
  for (const c of candidates) {
    console.log(`\n[${c.key}] ${c.fileName} (${c.originalPath})`);
    try {
      const existingEntry = ledger[c.key];

      let driveFileId: string;
      let expectedSha256: string | undefined = existingEntry?.sha256;

      if (existingEntry?.status === "uploaded" && existingEntry.driveFileId) {
        // Resume: Drive upload already happened in a previous run; verify
        // it's still there instead of uploading a duplicate.
        console.log(`  resuming from ledger: Drive file ${existingEntry.driveFileId} already uploaded`);
        const meta = await getFileMeta(existingEntry.driveFileId);
        if (meta.name !== c.fileName) {
          throw new Error(`ledger Drive file name mismatch: expected "${c.fileName}", found "${meta.name}"`);
        }
        driveFileId = existingEntry.driveFileId;
        summary.resumedFromLedger++;
      } else {
        if (DRY_RUN) {
          console.log(
            `  [dry-run] would download from ${c.bucket}/${c.originalPath}, upload to Drive under ${c.driveFolderSegments.join("/")}, verify, then update ${c.table}.file_path`
          );
          summary.skippedDryRun++;
          continue;
        }

        // 1/2. Download authoritative original bytes from Supabase Storage.
        const { data: blob, error: downloadError } = await supabase.storage
          .from(c.bucket)
          .download(c.originalPath);
        if (downloadError || !blob) {
          throw new Error(`Supabase Storage download failed: ${downloadError?.message ?? "no data"}`);
        }
        const buffer = Buffer.from(await blob.arrayBuffer());
        expectedSha256 = sha256(buffer);

        if (c.fileSize != null && buffer.byteLength !== c.fileSize) {
          console.warn(
            `  ! DB file_size (${c.fileSize}) differs from actual downloaded size (${buffer.byteLength}) — proceeding with actual bytes`
          );
        }

        // 3. Resolve/create the canonical Drive folder (reused, not duplicated).
        const folderId = await resolveFolderPath(c.driveFolderSegments);

        // 6/7. Upload the exact downloaded bytes to Drive.
        const uploaded = await uploadFile(
          folderId,
          c.fileName,
          c.fileType || "application/octet-stream",
          buffer
        );
        driveFileId = uploaded.id;

        ledger[c.key] = {
          status: "uploaded",
          driveFileId,
          bucket: c.bucket,
          originalPath: c.originalPath,
          sha256: expectedSha256,
          updatedAt: new Date().toISOString(),
        };
        saveLedger(ledger);
        console.log(`  uploaded -> Drive file ${driveFileId}`);
      }

      // 8/9/10. Verify Drive file exists, name, size.
      const meta = await getFileMeta(driveFileId);
      if (meta.name !== c.fileName) {
        throw new Error(`post-upload name mismatch: expected "${c.fileName}", Drive has "${meta.name}"`);
      }

      // 11/12. Byte-for-byte verification: download the Drive copy back and hash it.
      const driveStream = await downloadFileStream(driveFileId);
      const driveBuffer = await streamToBuffer(driveStream);
      const driveSha256 = sha256(driveBuffer);
      if (expectedSha256 && driveSha256 !== expectedSha256) {
        throw new Error(
          `byte verification FAILED: original sha256=${expectedSha256} drive sha256=${driveSha256}`
        );
      }
      console.log(`  verified: name ok, size=${driveBuffer.byteLength}B, sha256 match=${!!expectedSha256}`);

      // 13. Only now update the DB row.
      const { error: updateError } = await supabase
        .from(c.table)
        .update({ file_path: driveFileId })
        .eq("id", c.rowId);
      if (updateError) throw updateError;

      ledger[c.key] = {
        status: "db_updated",
        driveFileId,
        bucket: c.bucket,
        originalPath: c.originalPath,
        sha256: expectedSha256,
        updatedAt: new Date().toISOString(),
      };
      saveLedger(ledger);

      console.log(`  DONE: ${c.table}.id=${c.rowId} file_path -> ${driveFileId}`);
      summary.migratedThisRun++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${message}`);
      ledger[c.key] = {
        status: "failed",
        error: message,
        bucket: c.bucket,
        originalPath: c.originalPath,
        updatedAt: new Date().toISOString(),
      };
      saveLedger(ledger);
      summary.failed++;
      summary.failures.push({ key: c.key, error: message });
      // continue with other files — never abort the whole run
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN — no Drive uploads, no DB writes, no ledger persisted.");
    console.log("Re-run with --run to actually migrate.");
  }
}

main().catch((err) => {
  console.error("Migration script crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
