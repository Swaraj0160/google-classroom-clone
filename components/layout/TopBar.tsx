"use client";

import {
  Bell,
  Menu,
  Search,
  ChevronDown,
  Sun,
  Moon,
  FileCheck,
  ClipboardList,
  Award,
  Megaphone,
  UserPlus,
  Clock3,
  CheckCheck,
  IdCard,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications, type NotificationType } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/format";

const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  submission: FileCheck,
  assignment: ClipboardList,
  grade: Award,
  announcement: Megaphone,
  enrollment: UserPlus,
  deadline: Clock3,
  profile: IdCard,
};

function getInitials(name: string | null | undefined, email: string | undefined): string {
  const source = (name && name.trim()) || email || "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TopBar({
  collapsed,
  onMenuClick,
  dark,
  setDark,
}: {
  collapsed: boolean;
  onMenuClick: () => void;
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { profile } = useProfile();
  const displayName = profile?.full_name || profile?.email || "";
  const nameParts = displayName.split(" ").filter(Boolean);
  const router = useRouter();
  const { notifications, unreadCount, isRead, markAsRead, markAllAsRead } = useNotifications();

  function handleNotificationClick(id: string, href: string) {
    markAsRead(id);
    setNotifOpen(false);
    router.push(href);
  }

  function goToSettings() {
    setProfileOpen(false);
    router.push("/dashboard/settings");
  }

  async function handleSignOut() {
    setProfileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={`fixed top-0 right-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-white/90 px-4 backdrop-blur-md transition-all duration-300 dark:border-white/5 dark:bg-surface-dark/90 sm:px-6
      left-0 ${collapsed ? "lg:left-[76px]" : "lg:left-[264px]"}`}
    >
      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/10"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="text"
          placeholder="Search classes, students, assignments..."
          className="w-full rounded-full border border-transparent bg-surface-alt py-2.5 pl-11 pr-4 text-sm text-ink outline-none transition-all duration-200 focus:border-brand-blue/40 focus:bg-white focus:shadow-soft dark:bg-white/5 dark:text-white dark:focus:bg-white/10"
        />
      </div>

      <div className="flex-1 sm:hidden" />

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/10"
          title="Toggle theme"
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/10"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-surface-dark">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 animate-fadeInUp overflow-hidden rounded-2xl border border-black/5 bg-white shadow-elevated dark:border-white/10 dark:bg-surface-darkAlt sm:w-96">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
                <span className="text-sm font-semibold text-ink dark:text-white">Notifications</span>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
                  >
                    <CheckCheck size={13} />
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto scrollbar-none">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-ink-faint">
                    You&apos;re all caught up.
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = NOTIFICATION_ICONS[n.type];
                    const unread = !isRead(n.id);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n.id, n.href)}
                        className={`flex w-full items-start gap-3 border-b border-black/5 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-surface-alt dark:border-white/5 dark:hover:bg-white/5 ${
                          unread ? "bg-blue-50/60 dark:bg-blue-500/5" : ""
                        }`}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20">
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-ink dark:text-white">{n.title}</span>
                            {unread && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-soft dark:text-gray-400">
                            {n.message}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-ink-faint">
                            {formatRelativeTime(n.timestamp)}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-alt dark:hover:bg-white/10"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue ring-2 ring-white dark:ring-surface-darkAlt">
              {getInitials(profile?.full_name, profile?.email)}
            </span>
            <span className="hidden text-sm font-medium text-ink dark:text-white md:block">
              {nameParts[0] ?? ""} {nameParts.length > 1 ? nameParts[nameParts.length - 1] : ""}
            </span>
            <ChevronDown size={15} className="hidden text-ink-faint md:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 animate-fadeInUp overflow-hidden rounded-2xl border border-black/5 bg-white shadow-elevated dark:border-white/10 dark:bg-surface-darkAlt">
              <div className="flex flex-col items-center gap-2 border-b border-black/5 px-4 py-5 dark:border-white/10">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-lg font-semibold text-brand-blue">
                  {getInitials(profile?.full_name, profile?.email)}
                </span>
                <p className="text-sm font-semibold text-ink dark:text-white">{displayName || "—"}</p>
                <p className="text-xs text-ink-faint">{profile?.email}</p>
              </div>
              <div className="p-2">
                <button
                  onClick={goToSettings}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/5"
                >
                  My Profile
                </button>
                <button
                  onClick={goToSettings}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Account Settings
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-brand-red transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
