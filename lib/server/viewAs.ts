import type { NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";

export const VIEW_AS_COOKIE = "fc_view_as";

export interface RealUser {
  id: string;
  role: string | null;
}

/**
 * Resolves the REAL authenticated user from the Supabase session cookie and
 * their role from their OWN profiles row (always RLS-permitted — a user can
 * always read their own row). This is the only source of truth for "is this
 * caller actually an admin" — never the client-supplied view-as cookie.
 */
export async function getRealUser(request: NextRequest): Promise<RealUser | null> {
  const supabase = createSupabaseRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, role: profile?.role ?? null };
}

export async function requireAdmin(request: NextRequest): Promise<RealUser | null> {
  const real = await getRealUser(request);
  if (!real) {
    console.error("[requireAdmin] no authenticated session found on request");
    return null;
  }
  if (real.role !== "admin") {
    console.error(`[requireAdmin] caller ${real.id} has role "${real.role ?? "none"}", not admin`);
    return null;
  }
  return real;
}

/** Reads the currently-viewed profile id from the (httpOnly, server-set-only) cookie. */
export function getViewedUserId(request: NextRequest): string | null {
  return request.cookies.get(VIEW_AS_COOKIE)?.value || null;
}

export const VIEW_ONLY_MESSAGE = "View-only mode: this action is disabled.";
