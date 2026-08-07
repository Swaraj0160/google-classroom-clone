import { assignments, classes } from "@/lib/data";
import { ClipboardList, HelpCircle, BookOpen, Plus } from "lucide-react";

const typeConfig = {
  assignment: { icon: ClipboardList, color: "text-brand-blue", bg: "bg-blue-50 dark:bg-blue-500/10" },
  quiz: { icon: HelpCircle, color: "text-brand-purple", bg: "bg-purple-50 dark:bg-purple-500/10" },
  material: { icon: BookOpen, color: "text-brand-green", bg: "bg-green-50 dark:bg-green-500/10" },
};

const statusStyles = {
  draft: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  published: "bg-green-50 text-brand-green dark:bg-green-500/10",
  closed: "bg-red-50 text-brand-red dark:bg-red-500/10",
};

export default function AssignmentsPage() {
  return (
    <div className="animate-fadeInUp space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-white">Assignments</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
            Across all {classes.length} classes
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:bg-brand-blueDark hover:shadow-elevated active:scale-95">
          <Plus size={16} /> Create Assignment
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-surface-alt/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint dark:border-white/10 dark:bg-white/5">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Submissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {assignments.map((a) => {
                const cfg = typeConfig[a.type];
                const Icon = cfg.icon;
                return (
                  <tr key={a.id} className="transition-colors hover:bg-surface-alt/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
                          <Icon size={15} />
                        </div>
                        <span className="font-medium text-ink dark:text-white">{a.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-ink-soft dark:text-gray-400">{a.type}</td>
                    <td className="px-4 py-3 text-ink-soft dark:text-gray-400">{a.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusStyles[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-ink-soft dark:text-gray-400">
                      {a.submitted}/{a.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
