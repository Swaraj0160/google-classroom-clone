import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark">
      <header className="border-b border-black/5 bg-white dark:border-white/5 dark:bg-surface-darkAlt">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-brand-blue" />
            <Link href="/admin/users" className="text-sm font-semibold text-ink dark:text-white">
              Admin Console
            </Link>
          </div>
          <nav className="flex items-center gap-4 text-sm text-ink-soft dark:text-gray-400">
            <Link href="/admin/users" className="hover:text-ink dark:hover:text-white">
              Users
            </Link>
            <Link href="/admin/view-as" className="hover:text-ink dark:hover:text-white">
              View As
            </Link>
            <Link href="/admin/drive-status" className="hover:text-ink dark:hover:text-white">
              Drive Storage
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
