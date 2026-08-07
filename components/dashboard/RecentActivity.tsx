import { recentActivity } from "@/lib/data";
import {
  UploadCloud,
  Sparkles,
  ClipboardCheck,
  FileText,
  Megaphone,
} from "lucide-react";
import Image from "next/image";

const iconMap = {
  submission: { icon: UploadCloud, bg: "bg-blue-500" },
  grade: { icon: ClipboardCheck, bg: "bg-green-500" },
  assignment: { icon: FileText, bg: "bg-orange-500" },
  announcement: { icon: Megaphone, bg: "bg-purple-500" },
  ai: { icon: Sparkles, bg: "bg-fuchsia-500" },
} as const;

export default function RecentActivity() {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink dark:text-white">
          Recent Activity
        </h3>
        <button className="text-xs font-medium text-brand-blue hover:underline">
          View all
        </button>
      </div>

      <div className="space-y-1">
        {recentActivity.map((item, idx) => {
          const cfg = iconMap[item.type];
          const Icon = cfg.icon;
          return (
            <div key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
              {idx !== recentActivity.length - 1 && (
                <span className="absolute left-[15px] top-9 h-[calc(100%-20px)] w-px bg-black/5 dark:bg-white/10" />
              )}
              <div
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg} text-white shadow-soft`}
              >
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-ink dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-soft dark:text-gray-400">
                  {item.description}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {item.avatar === "ai" ? (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600">
                      <Sparkles size={9} className="text-white" />
                    </div>
                  ) : (
                    <Image
                      src={item.avatar}
                      alt={item.actor}
                      width={16}
                      height={16}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-[11px] text-ink-faint">{item.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
