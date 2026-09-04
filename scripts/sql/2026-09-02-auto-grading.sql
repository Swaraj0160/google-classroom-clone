-- Run once in the Supabase SQL Editor (this repo has no DB DDL access from
-- the app/service-role REST key, so this can't be applied automatically).
--
-- Additive only: one nullable column + one trigger. Never drops, truncates,
-- or rewrites existing rows. Existing submissions.marks values are left
-- exactly as they are — this only affects future writes to submitted_at.
-- Existing (already-submitted, currently ungraded) rows need the separate,
-- explicit backfill script (scripts/auto-grade-backfill.ts, dry-run by
-- default) — this migration alone does not touch them.
--
-- Mirrors lib/grading.ts's calculateSubmissionGrade exactly: on time -> 100%
-- of total_marks, > deadline and <= 48h late -> 80%, > 48h late -> 70%,
-- rounded to the nearest whole mark. No due_date on the assignment means
-- there's no deadline to miss, so always full marks (matches the existing
-- convention already used for the faculty "suggested grade" UI).

alter table submissions
  add column if not exists grading_source text;

alter table submissions
  drop constraint if exists submissions_grading_source_check;

alter table submissions
  add constraint submissions_grading_source_check
  check (grading_source is null or grading_source in ('auto', 'manual'));

create or replace function auto_grade_submission()
returns trigger
language plpgsql
as $$
declare
  v_due_date timestamptz;
  v_total_marks numeric;
  v_late_ms bigint;
  v_multiplier numeric;
begin
  -- Nothing submitted (a brand-new pending row, or an explicit unsubmit) —
  -- leave whatever the caller already set (e.g. status='pending') alone.
  if new.submitted_at is null then
    return new;
  end if;

  -- A faculty member has explicitly graded this — never touch it again,
  -- regardless of timing/resubmission.
  if new.grading_source = 'manual' then
    return new;
  end if;

  select due_date, total_marks into v_due_date, v_total_marks
  from assignments
  where id = new.assignment_id;

  -- No max marks configured on the assignment — nothing to compute against;
  -- leave marks untouched rather than guessing.
  if v_total_marks is null then
    return new;
  end if;

  if v_due_date is null then
    v_multiplier := 1.0;
  else
    v_late_ms := floor(extract(epoch from (new.submitted_at - v_due_date)) * 1000);
    if v_late_ms <= 0 then
      v_multiplier := 1.0;
    elsif v_late_ms <= 48 * 60 * 60 * 1000 then
      v_multiplier := 0.8;
    else
      v_multiplier := 0.7;
    end if;
  end if;

  new.marks := round(v_total_marks * v_multiplier);
  new.status := 'graded';
  new.grading_source := 'auto';
  return new;
end;
$$;

drop trigger if exists trg_auto_grade_submission on submissions;

create trigger trg_auto_grade_submission
before insert or update of submitted_at on submissions
for each row
execute function auto_grade_submission();
