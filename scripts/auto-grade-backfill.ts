/**
 * One-time backfill for submissions that were already submitted before the
 * auto-grading trigger (scripts/sql/2026-09-02-auto-grading.sql) existed —
 * the trigger only fires on future writes to submitted_at, so it never
 * retroactively touches rows already sitting in the table.
 *
 * Scope, strictly: submissions where submitted_at IS NOT NULL and status IS
 * NOT 'graded' (and, defensively, grading_source is not already 'manual').
 * This is deliberately NOT "marks IS NULL" — submissions.marks defaults to
 * 0 at the database level for every row from the moment it's created (the
 * initial "pending" insert never sets marks at all), so it is never actually
 * NULL in production; a `marks IS NULL` filter matches zero real rows here.
 * status is the authoritative "already graded" indicator used everywhere
 * else in this app (see hooks/useAssignmentSubmissions.ts, MarksTab.tsx,
 * app/dashboard/submissions/[id]/page.tsx, the student grades page): it only
 * becomes "graded" via an explicit faculty save or the auto-grading trigger,
 * so any row still sitting at "submitted"/"late" is genuinely ungraded
 * regardless of what raw value happens to be in marks.
 *
 * Defaults to --dry-run (prints the report, writes nothing). Pass --confirm
 * to actually apply it. Never overwrites an existing mark, never touches
 * assignments/courses/students, never deletes anything.
 *
 * Usage:
 *   npm run grade:backfill                 (dry run — report only)
 *   npm run grade:backfill -- --confirm    (applies auto grades)
 */
import { loadEnvLocal, requireEnv } from "./migration-env.ts";

loadEnvLocal();
requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

const { calculateSubmissionGrade, formatLateness } = await import("../lib/grading.ts");
const { createSupabaseAdminClient } = await import("../lib/server/supabaseAdmin.ts");

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const supabase = createSupabaseAdminClient();

  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, assignment_id, student_id, submitted_at, marks, status, grading_source")
    .not("submitted_at", "is", null)
    .neq("status", "graded")
    .or("grading_source.is.null,grading_source.neq.manual");
  if (error) throw error;

  console.log(`\n=== Auto-grade backfill — ${CONFIRM ? "LIVE (will write)" : "DRY RUN"} ===`);
  console.log(`Found ${submissions?.length ?? 0} submitted-but-ungraded row(s) to evaluate.\n`);

  if (!submissions || submissions.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const assignmentIds = [...new Set(submissions.map((s) => s.assignment_id))];
  const studentIds = [...new Set(submissions.map((s) => s.student_id))];

  const [{ data: assignments }, { data: students }] = await Promise.all([
    supabase.from("assignments").select("id, title, due_date, total_marks, course_id").in("id", assignmentIds),
    supabase.from("profiles").select("id, full_name, email, roll_number").in("id", studentIds),
  ]);
  const assignmentById = new Map((assignments ?? []).map((a) => [a.id, a]));
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  let wouldChange = 0;
  let skippedNoMaxMarks = 0;
  const writes: { id: string; marks: number }[] = [];

  console.log(
    ["Assignment", "Student", "Submitted", "Deadline", "Late by", "Current", "Proposed", "Change?"].join(" | ")
  );

  for (const s of submissions) {
    const assignment = assignmentById.get(s.assignment_id);
    const student = studentById.get(s.student_id);
    const studentLabel = student
      ? `${student.roll_number ? student.roll_number + " - " : ""}${student.full_name ?? student.email}`
      : s.student_id.slice(0, 8);
    const assignmentLabel = assignment?.title ?? s.assignment_id.slice(0, 8);

    if (!assignment || assignment.total_marks === null || assignment.total_marks === undefined) {
      skippedNoMaxMarks++;
      console.log(
        [assignmentLabel, studentLabel, s.submitted_at, "—", "—", s.marks, "SKIP (no total_marks)", "NO"].join(" | ")
      );
      continue;
    }

    const { suggestedMarks, lateByMs } = calculateSubmissionGrade({
      dueAt: assignment.due_date,
      submittedAt: s.submitted_at,
      maxMarks: assignment.total_marks,
    });

    if (suggestedMarks === null) continue;

    wouldChange++;
    writes.push({ id: s.id, marks: suggestedMarks });
    console.log(
      [
        assignmentLabel,
        studentLabel,
        s.submitted_at,
        assignment.due_date ?? "(none)",
        formatLateness(lateByMs) ?? "on time",
        s.marks,
        suggestedMarks,
        "YES",
      ].join(" | ")
    );
  }

  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      { total: submissions.length, wouldChange, skippedNoMaxMarks, mode: CONFIRM ? "live" : "dry-run" },
      null,
      2
    )
  );

  if (!CONFIRM) {
    console.log("\nThis was a DRY RUN — nothing was written. Re-run with --confirm to apply.");
    return;
  }

  console.log(`\nApplying ${writes.length} auto-grade(s)...`);
  let applied = 0;
  let failed = 0;
  for (const w of writes) {
    // Re-check this row is still ungraded immediately before writing —
    // closes the gap if a faculty member graded it (or the DB trigger fired
    // on a resubmission) between the read above and now.
    const { data: current } = await supabase
      .from("submissions")
      .select("status, grading_source")
      .eq("id", w.id)
      .maybeSingle();
    if (!current || current.status === "graded" || current.grading_source === "manual") {
      console.log(`  skip ${w.id}: no longer ungraded`);
      continue;
    }
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ marks: w.marks, status: "graded", grading_source: "auto" })
      .eq("id", w.id)
      .neq("status", "graded");
    if (updateError) {
      console.error(`  FAILED ${w.id}:`, updateError.message);
      failed++;
    } else {
      applied++;
    }
  }
  console.log(`\nApplied ${applied}, failed ${failed}.`);
}

main().catch((err) => {
  console.error("auto-grade-backfill crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
