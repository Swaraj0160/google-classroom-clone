"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(data as Profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
  };
}
