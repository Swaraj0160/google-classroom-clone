"use client";

import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";

export interface DropdownOption {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  options: DropdownOption[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, options, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {trigger}
      </button>

      {open && (
        <div
          className={`absolute z-20 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.label}
                disabled={opt.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  opt.onClick();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  opt.destructive
                    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {Icon && <Icon size={14} />}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}