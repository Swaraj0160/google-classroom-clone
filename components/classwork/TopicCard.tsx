"use client";

import { ChevronDown, ChevronUp, Edit3, MoreVertical, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";

interface TopicCardProps {
  title: string;
  isFaculty: boolean;
  collapsed: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleCollapse: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function TopicCard({
  title,
  isFaculty,
  collapsed,
  isFirst,
  isLast,
  onToggleCollapse,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TopicCardProps) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onToggleCollapse} className="flex items-center gap-2 text-left">
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </h3>
      </button>

      {isFaculty && (
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded-full p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-gray-700"
            title="Move up"
          >
            <ChevronUp size={15} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded-full p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-gray-700"
            title="Move down"
          >
            <ChevronDown size={15} />
          </button>
          <Dropdown
            trigger={<MoreVertical size={15} />}
            options={[
              { label: "Rename topic", icon: Edit3, onClick: onRename },
              { label: "Delete topic", icon: Trash2, onClick: onDelete, destructive: true },
            ]}
          />
        </div>
      )}
    </div>
  );
}
