"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { compareByRollNumber } from "@/lib/format";
import { showToast } from "@/lib/toast";

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  roll_number: string | null;
}

type RoleFilter = "all" | "admin" | "faculty" | "student";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load users.");
        setUsers(data.users ?? []);
        setLoadError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load users.";
        setLoadError(message);
        showToast.error(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => roleFilter === "all" || u.role === roleFilter)
      .filter((u) => {
        if (!q) return true;
        return (
          (u.full_name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.roll_number ?? "").toLowerCase().includes(q)
        );
      })
      .sort(compareByRollNumber);
  }, [users, query, roleFilter]);

  async function startViewAs(target: AdminUser) {
    setStarting(true);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewedUserId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start View As.");
      setConfirmTarget(null);
      router.push("/admin/view-as");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Could not start View As.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Users</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Search, filter, and inspect any account in read-only View As mode.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or roll number"
            className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue dark:border-white/10 dark:bg-surface-darkAlt dark:text-white"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="faculty">Faculty</option>
          <option value="student">Student</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 text-xs uppercase tracking-wide text-ink-faint dark:border-white/5">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Roll No.</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                  Loading users…
                </td>
              </tr>
            )}
            {!loading && loadError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-red-600 dark:text-red-400">
                  {loadError}
                </td>
              </tr>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                  No users match your search.
                </td>
              </tr>
            )}
            {!loading &&
              !loadError &&
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-ink dark:text-white">
                    {u.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft dark:text-gray-400">{u.email}</td>
                  <td className="px-4 py-3 capitalize text-ink-soft dark:text-gray-400">{u.role}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-gray-400">
                    {u.role === "student" ? u.roll_number?.trim() || "Not set" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmTarget(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-semibold text-brand-blue transition hover:bg-brand-blue/20"
                    >
                      <Eye size={14} /> View As
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-darkAlt">
            <h2 className="text-lg font-semibold text-ink dark:text-white">
              View this profile as read-only?
            </h2>
            <p className="mt-2 text-sm text-ink-soft dark:text-gray-400">
              {confirmTarget.full_name || confirmTarget.email} ·{" "}
              <span className="capitalize">{confirmTarget.role}</span>
            </p>
            <p className="mt-3 text-sm text-ink-soft dark:text-gray-400">
              This will let you inspect the application from this user&apos;s perspective. No
              changes can be made.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={starting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => startViewAs(confirmTarget)}
                disabled={starting}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
              >
                {starting ? "Starting…" : "View As"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
