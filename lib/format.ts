export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Natural sort by roll number (so "2" sorts before "10"), with students
 * lacking a roll number pushed to the end. Falls back to name — for the
 * missing-roll-number group, and as a deterministic tie-break if two
 * students somehow share the same roll number (never silently reorders
 * or hides either one).
 */
export function compareByRollNumber<
  T extends { roll_number?: string | null; full_name?: string | null; name?: string | null }
>(a: T, b: T): number {
  const rollA = a.roll_number?.trim() || null;
  const rollB = b.roll_number?.trim() || null;
  const nameOf = (v: T) => v.full_name ?? v.name ?? "";

  if (rollA && rollB) {
    const cmp = rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: "base" });
    return cmp !== 0 ? cmp : nameOf(a).localeCompare(nameOf(b));
  }
  if (rollA) return -1;
  if (rollB) return 1;

  return nameOf(a).localeCompare(nameOf(b));
}