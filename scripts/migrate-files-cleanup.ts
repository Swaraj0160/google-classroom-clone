/**
 * SEPARATE, explicit cleanup step (Phase 8) — deletes the original Supabase
 * Storage object for rows that migrate-files-to-drive.ts has fully migrated
 * AND verified. Never runs automatically as part of the migration itself.
 *
 * Safety model:
 *   - Only considers ledger entries with status "db_updated".
 *   - Re-reads the live DB row and refuses to delete unless file_path now
 *     equals the ledger's recorded driveFileId (i.e. the migration's own DB
 *     update is confirmed still in place, not reverted/overwritten since).
 *   - Re-verifies the Drive file still exists before deleting anything.
 *   - Deletes ONLY the exact original object path recorded in the ledger —
 *     never a bucket, never a prefix, never a guess.
 *   - Defaults to --dry-run; requires --confirm to actually delete.
 *
 * Usage:
 *   npm run migrate:files:cleanup                  (dry run — lists what would be deleted)
 *   npm run migrate:files:cleanup -- --confirm      (actually deletes)
 */
import { readFileSync, existsSync } from "fs";
import { loadEnvLocal, requireEnv } from "./migration-env.ts";

loadEnvLocal();
requireEnv([
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
]);

const { getFileMeta } = await import("../lib/server/googleDrive.ts");
const { createSupabaseAdminClient } = await import("../lib/server/supabaseAdmin.ts");

const CONFIRM = process.argv.includes("--confirm");
const STATE_PATH = "scripts/.migration-state.json";

interface LedgerEntry {
  status: "uploaded" | "db_updated" | "failed";
  driveFileId?: string;
  bucket?: "submissions" | "classroom-files";
  originalPath?: string;
  error?: string;
  updatedAt: string;
}

function tableFromKey(key: string): "submission_files" | "assignment_attachments" | "announcement_attachments" {
  const table = key.split(":")[0];
  if (table !== "submission_files" && table !== "assignment_attachments" && table !== "announcement_attachments") {
    throw new Error(`Unrecognized ledger key table: ${key}`);
  }
  return table;
}

async function main() {
  if (!existsSync(STATE_PATH)) {
    console.log(`No migration ledger found at ${STATE_PATH} — nothing to clean up.`);
    return;
  }
  const ledger: Record<string, LedgerEntry> = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  const supabase = createSupabaseAdminClient();

  console.log(`\n=== Cleanup Legacy Supabase Storage Objects — ${CONFIRM ? "LIVE (will delete)" : "DRY RUN"} ===\n`);

  let eligible = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const [key, entry] of Object.entries(ledger)) {
    if (entry.status !== "db_updated" || !entry.driveFileId || !entry.bucket || !entry.originalPath) {
      continue;
    }
    eligible++;
    const rowId = key.split(":")[1];
    const table = tableFromKey(key);

    try {
      const { data: row, error } = await supabase.from(table).select("file_path").eq("id", rowId).maybeSingle();
      if (error) throw error;
      if (!row) {
        console.warn(`  skip ${key}: DB row no longer exists`);
        skipped++;
        continue;
      }
      if (row.file_path !== entry.driveFileId) {
        console.warn(
          `  skip ${key}: DB file_path (${row.file_path}) no longer matches migrated Drive id (${entry.driveFileId}) — will not delete original`
        );
        skipped++;
        continue;
      }

      await getFileMeta(entry.driveFileId); // throws if the Drive file is gone

      if (!CONFIRM) {
        console.log(`  [dry-run] would delete ${entry.bucket}/${entry.originalPath} (${key})`);
        continue;
      }

      const { error: removeError } = await supabase.storage.from(entry.bucket).remove([entry.originalPath]);
      if (removeError) throw removeError;

      console.log(`  deleted ${entry.bucket}/${entry.originalPath} (${key})`);
      deleted++;
    } catch (err) {
      console.error(`  FAILED ${key}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ eligible, deleted, skipped, failed, mode: CONFIRM ? "live" : "dry-run" }, null, 2));
  if (!CONFIRM) {
    console.log("\nThis was a DRY RUN — nothing was deleted. Re-run with --confirm to actually delete.");
  }
}

main().catch((err) => {
  console.error("Cleanup script crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
