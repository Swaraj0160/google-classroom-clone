"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  roll_number: string | null;
  created_at: string;
}

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

type Listener = (profile: Profile | null, loading: boolean, error: string | null) => void;

// Shared across every useProfile() instance in the app (TopBar, ClassworkTab,
// StreamTab, AIInsightsTab, ...) so the current user's profile is fetched once
// per session instead of once per mounted component.
let cachedProfile: Profile | null = null;
let cachedUserId: string | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify(profile: Profile | null, loading: boolean, error: string | null) {
  listeners.forEach((listener) => listener(profile, loading, error));
}

function loadProfile(force = false): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        cachedProfile = null;
        cachedUserId = null;
        notify(null, false, null);
        return;
      }

      if (!force && cachedProfile && cachedUserId === user.id) {
        notify(cachedProfile, false, null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, roll_number, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        notify(cachedProfile, false, error.message);
        return;
      }

      cachedProfile = data as Profile | null;
      cachedUserId = user.id;
      notify(cachedProfile, false, null);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [loading, setLoading] = useState(!cachedProfile);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadProfile(true);
  }, []);

  useEffect(() => {
    const listener: Listener = (p, l, e) => {
      setProfile(p);
      setLoading(l);
      setError(e);
    };
    listeners.add(listener);

    if (cachedProfile) {
      listener(cachedProfile, false, null);
    } else {
      loadProfile();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile(true);
    });

    return () => {
      listeners.delete(listener);
      subscription.unsubscribe();
    };
  }, []);

  return {
    profile,
    loading,
    error,
    refresh,
  };
}
