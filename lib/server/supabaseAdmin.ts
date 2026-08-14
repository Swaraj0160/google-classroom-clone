import { createClient } from "@supabase/supabase-js";

/** Thrown when required server-only env vars for the admin client are absent. */
export class AdminNotConfiguredError extends Error {
  constructor(missingVars: string[]) {
    // Names only — never values — so this is safe to log server-side.
    super(`Missing required server env var(s): ${missingVars.join(", ")}`);
    this.name = "AdminNotConfiguredError";
  }
}

/**
 * Service-role Supabase client — bypasses RLS. Used ONLY by admin-only,
 * server-verified routes (see lib/server/viewAs.ts) to read another user's
 * data for View As, and by the one-time file-storage migration scripts
 * (scripts/migrate-files-*.ts). Never imported by any "use client" file;
 * the key is never sent to the browser. Deliberately has no dependency on
 * "next/server" so it can also be imported from standalone Node scripts
 * outside the Next.js build — see lib/server/adminApiError.ts for the
 * Next.js-specific response helper.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new AdminNotConfiguredError(missing);

  return createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
