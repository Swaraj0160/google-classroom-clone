"use client";

import { Bell, Menu, Search, ChevronDown, Sun, Moon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { faculty } from "@/lib/data";

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
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-red ring-2 ring-white dark:ring-surface-dark" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 animate-fadeInUp overflow-hidden rounded-2xl border border-black/5 bg-white shadow-elevated dark:border-white/10 dark:bg-surface-darkAlt">
              <div className="border-b border-black/5 px-4 py-3 text-sm font-semibold dark:border-white/10">
                Notifications
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-none">
                {[
                  { t: "42 new submissions in CS404", s: "2 min ago" },
                  { t: "AI flagged 3 at-risk students in CS301", s: "1 hr ago" },
                  { t: "Marks approved for CS210", s: "3 hr ago" },
                ].map((n, i) => (
                  <div
                    key={i}
                    className="cursor-pointer border-b border-black/5 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-surface-alt dark:border-white/5 dark:hover:bg-white/5"
                  >
                    <p className="font-medium text-ink dark:text-white">{n.t}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{n.s}</p>
                  </div>
                ))}
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
            <Image
              src={faculty.avatar}
              alt={faculty.name}
              width={34}
              height={34}
              className="rounded-full ring-2 ring-white dark:ring-surface-darkAlt"
            />
            <span className="hidden text-sm font-medium text-ink dark:text-white md:block">
              {faculty.name.split(" ")[0]} {faculty.name.split(" ")[2] ?? ""}
            </span>
            <ChevronDown size={15} className="hidden text-ink-faint md:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 animate-fadeInUp overflow-hidden rounded-2xl border border-black/5 bg-white shadow-elevated dark:border-white/10 dark:bg-surface-darkAlt">
              <div className="flex flex-col items-center gap-2 border-b border-black/5 px-4 py-5 dark:border-white/10">
                <Image
                  src={faculty.avatar}
                  alt={faculty.name}
                  width={56}
                  height={56}
                  className="rounded-full"
                />
                <p className="text-sm font-semibold text-ink dark:text-white">{faculty.name}</p>
                <p className="text-xs text-ink-faint">{faculty.email}</p>
              </div>
              <div className="p-2">
                <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/5">
                  My Profile
                </button>
                <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-alt dark:text-gray-300 dark:hover:bg-white/5">
                  Account Settings
                </button>
                <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-brand-red transition-colors hover:bg-red-50 dark:hover:bg-red-500/10">
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
