import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-gray-700">
        <Icon size={26} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-gray-400">{description}</p>
    </div>
  );
}