"use client";

import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";

import type { SubmissionStatus } from "@/types/submission";

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
}

const STATUS = {
  pending: {
    label: "Pending",
    icon: ClipboardList,
    className:
      "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },

  submitted: {
    label: "Submitted",
    icon: CheckCircle2,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300",
  },

  late: {
    label: "Late",
    icon: Clock3,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  },

  graded: {
    label: "Graded",
    icon: CheckCircle2,
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-300",
  },
} satisfies Record<
  SubmissionStatus,
  {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    className: string;
  }
>;

export function SubmissionStatusBadge({
  status,
}: SubmissionStatusBadgeProps) {
  const item = STATUS[status];
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${item.className}`}
    >
      <Icon size={13} />
      {item.label}
    </span>
  );
}