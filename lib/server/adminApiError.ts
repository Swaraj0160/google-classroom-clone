import { NextResponse } from "next/server";
import { AdminNotConfiguredError } from "@/lib/server/supabaseAdmin";

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
