"use client";

import { useCallback, useEffect, useState } from "react";

export interface ViewedUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  roll_number: string | null;
}

interface UseViewAsStatusResult {
  active: boolean;
  viewedUser: ViewedUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  exit: () => Promise<void>;
}

export function useViewAsStatus(): UseViewAsStatusResult {
  const [active, setActive] = useState(false);
  const [viewedUser, setViewedUser] = useState<ViewedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/view-as/status", { cache: "no-store" });
      const data = await res.json();
      setActive(Boolean(data.active));
      setViewedUser(data.viewedUser ?? null);
    } catch {
      setActive(false);
      setViewedUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const exit = useCallback(async () => {
    await fetch("/api/admin/view-as", { method: "DELETE" });
    setActive(false);
    setViewedUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { active, viewedUser, loading, refresh, exit };
}
