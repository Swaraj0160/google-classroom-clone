import Image from "next/image";
import { faculty } from "@/lib/data";
import { Bell, Lock, Palette, User } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Manage your profile and preferences
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
        <div className="flex flex-wrap items-center gap-4">
          <Image src={faculty.avatar} alt={faculty.name} width={72} height={72} className="rounded-full" />
          <div>
            <p className="text-lg font-semibold text-ink dark:text-white">{faculty.name}</p>
            <p className="text-sm text-ink-faint">{faculty.title}</p>
            <p className="text-sm text-ink-faint">{faculty.email}</p>
          </div>
          <button className="ml-auto rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-alt dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
            Edit profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { icon: User, title: "Account", desc: "Update your name, title, and department" },
          { icon: Bell, title: "Notifications", desc: "Choose what updates you receive" },
          { icon: Lock, title: "Privacy & Security", desc: "Manage password and login sessions" },
          { icon: Palette, title: "Appearance", desc: "Switch between light and dark themes" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="flex items-start gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-card transition-shadow hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue dark:bg-blue-500/10">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink dark:text-white">{s.title}</p>
                <p className="mt-0.5 text-xs text-ink-faint">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
