import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  accent: string; // tailwind gradient classes
  suffix?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent,
  suffix,
}: StatCardProps) {
  const hasTrend = trend !== undefined;
  const positive = hasTrend && trend >= 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated dark:border-white/5 dark:bg-surface-darkAlt">
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-10 transition-transform duration-500 group-hover:scale-125`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-soft`}
        >
          <Icon size={20} />
        </div>
        {hasTrend && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${
              positive
                ? "bg-green-50 text-brand-green dark:bg-green-500/10"
                : "bg-red-50 text-brand-red dark:bg-red-500/10"
            }`}
          >
            {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="relative mt-4 text-3xl font-bold tracking-tight text-ink dark:text-white">
        {value}
        {suffix && <span className="text-lg text-ink-faint">{suffix}</span>}
      </p>
      <p className="relative mt-1 text-sm font-medium text-ink-soft dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}