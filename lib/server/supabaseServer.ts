import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

/**
 * Cookie-authenticated Supabase client for Route Handlers. Read-only use —
 * these routes never need to refresh/write the session cookie, they only
 * need to know who the already-authenticated caller is.
 */
export function createSupabaseRouteClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // no-op: nothing in this app's file routes needs to persist a
          // refreshed session cookie back to the response.
        },
      },
    }
  );
}
