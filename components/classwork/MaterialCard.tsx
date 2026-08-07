"use client";

import { BookOpen, Edit3, MoreVertical, Trash2 } from "lucide-react";
import { ClassworkItem } from "@/types/classwork";
import { Dropdown } from "@/components/ui/Dropdown";

interface MaterialCardProps {
  item: ClassworkItem;
  isFaculty: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MaterialCard({ item, isFaculty, onOpen, onEdit, onDelete }: MaterialCardProps) {
  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
        <BookOpen size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 truncate text-xs text-gray-400">{item.description}</p>
        )}
      </div>

      {isFaculty && (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={<MoreVertical size={16} />}
            options={[
              { label: "Edit", icon: Edit3, onClick: onEdit },
              { label: "Delete", icon: Trash2, onClick: onDelete, destructive: true },
            ]}
          />
        </div>
      )}
    </div>
  );
}