"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  UploadCloud,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const navSections: NavSection[] = [
  { label: null, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Teaching",
    items: [
      { label: "Classes", href: "/dashboard/classes", icon: BookOpen },
      { label: "Assignments", href: "/dashboard/assignments", icon: ClipboardList },
      { label: "Submissions", href: "/dashboard/submissions", icon: UploadCloud },
      { label: "Students", href: "/dashboard/students", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "AI Insights", href: "/dashboard/ai-insights", icon: Sparkles, badge: "New" },
    ],
  },
];

const bottomItems: NavItem[] = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 flex h-screen flex-col border-r border-black/5 bg-white transition-all duration-300 ease-in-out dark:border-white/5 dark:bg-surface-darkAlt
        ${collapsed ? "w-[76px]" : "w-[264px]"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-indigo-600 text-white shadow-glow">
            <GraduationCap size={20} />
          </div>
          {!collapsed && (
            <span className="truncate text-[17px] font-semibold tracking-tight text-ink dark:text-white">
              Faculty Classroom
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-2 flex-1 space-y-4 overflow-y-auto scrollbar-none px-3">
          {navSections.map((section, sectionIndex) => (
            <div key={section.label ?? `section-${sectionIndex}`} className="space-y-1">
              {section.label && !collapsed && (
                <p className="px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint/70 dark:text-gray-500">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[14px] font-medium transition-all duration-200
                    ${
                      active
                        ? "bg-blue-50 text-brand-blueDark dark:bg-blue-500/15 dark:text-blue-300"
                        : "text-ink-soft hover:bg-surface-alt dark:text-gray-400 dark:hover:bg-white/5"
                    }
                    ${collapsed ? "justify-center" : ""}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.4 : 2}
                      className={`shrink-0 transition-transform duration-200 ${
                        active ? "scale-105" : "group-hover:scale-105"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="ml-auto rounded-full bg-gradient-to-r from-brand-purple to-pink-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        {item.badge}
                      </span>
                    )}
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-blue" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="space-y-1 border-t border-black/5 px-3 py-3 dark:border-white/5">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[14px] font-medium transition-colors duration-200 ${
                  active
                    ? "bg-blue-50 text-brand-blueDark dark:bg-blue-500/15 dark:text-blue-300"
                    : "text-ink-soft hover:bg-surface-alt dark:text-gray-400 dark:hover:bg-white/5"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
          <button
            className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-[14px] font-medium text-brand-red transition-colors duration-200 hover:bg-red-50 dark:hover:bg-red-500/10 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut size={20} />
            {!collapsed && <span>Logout</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-2 hidden w-full items-center justify-center gap-2 rounded-full border border-black/5 py-2 text-ink-faint transition-colors hover:bg-surface-alt dark:border-white/10 dark:hover:bg-white/5 lg:flex"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}
