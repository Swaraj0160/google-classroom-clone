// Shared env loader for the standalone migration scripts (run via
// `node scripts/*.ts` outside the Next.js dev/build process, so
// NEXT_PUBLIC_SUPABASE_URL etc. aren't auto-loaded from .env.local the way
// `next dev`/`next build` do it — this replicates that for these scripts
// only. Never logs any value, only confirms presence.
import { readFileSync, existsSync } from "fs";

export function loadEnvLocal(): void {
  const path = ".env.local";
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function requireEnv(names: string[]): void {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(", ")}`);
  }
}
