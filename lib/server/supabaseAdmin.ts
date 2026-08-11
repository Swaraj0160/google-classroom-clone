import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
 * data for View As. Never imported by any "use client" file; the key is
 * never sent to the browser.
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

/**
 * Classifies an error from an admin read route into a safe HTTP response.
 * Server-side detail (env var names, Supabase error codes/messages) is
 * logged for diagnosis; the browser only ever gets a generic, non-sensitive
 * message. Never pass raw error objects or secrets to NextResponse.json.
 */
export function adminErrorResponse(
  context: string,
  err: unknown,
  fallbackMessage: string
): NextResponse {
  if (err instanceof AdminNotConfiguredError) {
    console.error(`[${context}] not configured:`, err.message);
    return NextResponse.json(
      { error: "Admin features are not configured on the server. Contact the site administrator." },
      { status: 503 }
    );
  }

  // Supabase/Postgrest errors carry a code/message/details/hint — useful for
  // diagnosis and safe to log (schema/query info, not credentials).
  const supabaseError = err as { code?: string; message?: string; details?: string; hint?: string };
  if (supabaseError && typeof supabaseError === "object" && "code" in supabaseError) {
    console.error(`[${context}] query error:`, {
      code: supabaseError.code,
      message: supabaseError.message,
      details: supabaseError.details,
      hint: supabaseError.hint,
    });
    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
  }

  console.error(`[${context}]`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
