"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  User,
} from "lucide-react";

const menu = [
  {
    label: "Dashboard",
    href: "/student/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Classes",
    href: "/student/classes",
    icon: BookOpen,
  },
  {
    label: "Grades",
    href: "/student/grades",
    icon: GraduationCap,
  },
  {
    label: "Profile",
    href: "/student/profile",
    icon: User,
  },
];

export default function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-6 dark:border-gray-800">
          <h1 className="text-xl font-bold text-blue-600">
            Student Portal
          </h1>
        </div>

        <nav className="space-y-1 p-4">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}