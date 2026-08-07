import Image from "next/image";
import { announcements, recentActivity } from "@/lib/data";
import { ClassItem } from "@/lib/types";
import {
  MessageSquare,
  Megaphone,
  ClipboardList,
  FileText,
  Sparkles,
} from "lucide-react";

export default function StreamTab({ item }: { item: ClassItem }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Announcements */}
      <div className="space-y-4 lg:col-span-2">
        {/* Composer */}
        <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <Image
            src="https://i.pravatar.cc/150?img=47"
            alt="You"
            width={38}
            height={38}
            className="rounded-full"
          />
          <button className="flex-1 rounded-full border border-black/10 px-4 py-2.5 text-left text-sm text-ink-faint transition-colors hover:bg-surface-alt dark:border-white/10 dark:hover:bg-white/5">
            Share an announcement with {item.code}...
          </button>
        </div>

        {announcements.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-black/5 bg-white p-5 shadow-card transition-shadow hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt"
          >
            <div className="flex items-center gap-3">
              <Image
                src={a.avatar}
                alt={a.author}
                width={38}
                height={38}
                className="rounded-full"
              />
              <div>
                <p className="text-sm font-semibold text-ink dark:text-white">
                  {a.author}
                </p>
                <p className="text-xs text-ink-faint">{a.time}</p>
              </div>
              <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-brand-purple dark:bg-purple-500/10">
                <Megaphone size={15} />
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft dark:text-gray-300">
              {a.content}
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-black/5 pt-3 text-xs text-ink-faint dark:border-white/10">
              <MessageSquare size={14} />
              {a.comments} class comments
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar: assignments + activity */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
            <ClipboardList size={16} className="text-brand-blue" /> Upcoming
          </h3>
          <div className="space-y-3">
            {[
              { title: "Dynamic Programming — Problem Set", due: "Aug 12" },
              { title: "Heaps & Priority Queues Quiz", due: "Aug 18" },
            ].map((x) => (
              <div
                key={x.title}
                className="flex items-start gap-2.5 rounded-xl border border-black/5 p-3 dark:border-white/10"
              >
                <FileText size={16} className="mt-0.5 shrink-0 text-brand-yellow" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink dark:text-white">
                    {x.title}
                  </p>
                  <p className="text-[11px] text-ink-faint">Due {x.due}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
            <Sparkles size={16} className="text-brand-purple" /> Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink dark:text-white">
                    {a.title}
                  </p>
                  <p className="text-[11px] text-ink-faint">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
