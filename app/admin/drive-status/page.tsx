"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Loader2 } from "lucide-react";

interface DriveHealth {
  status:
    | "DRIVE_AUTHENTICATED"
    | "DRIVE_AUTH_REQUIRED"
    | "DRIVE_STORAGE_QUOTA_EXCEEDED"
    | "DRIVE_PERMISSION_DENIED"
    | "DRIVE_RATE_LIMITED"
    | "DRIVE_NETWORK_ERROR"
    | "DRIVE_FILE_NOT_FOUND"
    | "DRIVE_UNKNOWN_ERROR";
  checkedAt: string;
  quota?: { limitBytes: number | null; usageBytes: number; usageInDriveBytes: number };
  message?: string;
}

const STATUS_LABEL: Record<DriveHealth["status"], string> = {
  DRIVE_AUTHENTICATED: "Connected",
  DRIVE_AUTH_REQUIRED: "Authentication required",
  DRIVE_STORAGE_QUOTA_EXCEEDED: "Storage quota exceeded",
  DRIVE_PERMISSION_DENIED: "Permission denied",
  DRIVE_RATE_LIMITED: "Temporarily rate-limited",
  DRIVE_NETWORK_ERROR: "Network error reaching Drive",
  DRIVE_FILE_NOT_FOUND: "Root folder not found",
  DRIVE_UNKNOWN_ERROR: "Unknown storage error",
};

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}
function tb(bytes: number): string {
  return (bytes / 1024 ** 4).toFixed(2) + " TB";
}

export default function DriveStatusPage() {
  const [health, setHealth] = useState<DriveHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/drive-health");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not check Drive status.");
      setHealth(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check Drive status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Checked once on load — this is a human-triggered diagnostic page, not
    // a polled dashboard widget, so it never adds to background Drive call
    // volume on its own.
    void load();
  }, []);

  const connected = health?.status === "DRIVE_AUTHENTICATED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Google Drive Storage</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          File storage for all assignment attachments and student submissions runs through the
          Google Drive account authorized below.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-soft dark:text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Checking Drive status…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm font-medium text-brand-red">
            <AlertTriangle size={16} /> {error}
          </div>
        ) : health ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {connected ? (
                  <CheckCircle2 size={20} className="text-brand-green" />
                ) : (
                  <AlertTriangle size={20} className="text-brand-red" />
                )}
                <span className="text-lg font-semibold text-ink dark:text-white">
                  {STATUS_LABEL[health.status]}
                </span>
              </div>
              <button
                onClick={() => void load()}
                className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-alt dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <RefreshCw size={13} /> Recheck
              </button>
            </div>

            {!connected && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {health.status === "DRIVE_AUTH_REQUIRED" ? (
                  <>
                    Google Drive needs to be reconnected by an administrator. Uploads, previews, and
                    downloads are unavailable until this is fixed.
                    <a
                      href="/api/auth/google"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      Reconnect Google Drive <ExternalLink size={13} />
                    </a>
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      Opens in a new tab, signed into the Google account that owns &quot;Faculty
                      Classroom Storage&quot;. Follow the on-screen instructions to copy the new
                      refresh token into <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> locally and in Vercel,
                      then redeploy.
                    </p>
                  </>
                ) : (
                  <>{health.message ?? "Google Drive is not currently reachable."}</>
                )}
              </div>
            )}

            {health.quota && (
              <div>
                <p className="text-xs font-medium text-ink-faint">Storage used</p>
                <p className="mt-1 text-2xl font-bold text-ink dark:text-white">
                  {gb(health.quota.usageBytes)}
                  {health.quota.limitBytes ? (
                    <span className="text-base font-medium text-ink-faint"> / {tb(health.quota.limitBytes)}</span>
                  ) : (
                    <span className="text-base font-medium text-ink-faint"> / unlimited</span>
                  )}
                </p>
              </div>
            )}

            <p className="text-xs text-ink-faint">
              Last checked {new Date(health.checkedAt).toLocaleString()}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
