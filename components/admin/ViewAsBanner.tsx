"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { useViewAsStatus } from "@/hooks/useViewAsStatus";

export default function ViewAsBanner() {
  const { active, viewedUser, exit } = useViewAsStatus();
  const router = useRouter();

  if (!active || !viewedUser) return null;

  async function handleExit() {
    await exit();
    router.push("/admin/users");
    router.refresh();
  }

  const name = viewedUser.full_name || viewedUser.email;

  return (
    <div className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <Eye size={16} className="shrink-0" />
      <span className="font-semibold">VIEW-ONLY MODE</span>
      <span>
        Viewing as {name} · <span className="capitalize">{viewedUser.role}</span>
      </span>
      <span className="text-amber-900/80">Your real admin account remains signed in.</span>
      <button
        onClick={handleExit}
        className="rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-900"
      >
        Exit View Mode
      </button>
    </div>
  );
}
