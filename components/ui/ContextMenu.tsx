"use client";

import { useEffect, useRef, useState } from "react";
import { DropdownOption } from "./Dropdown";

interface ContextMenuProps {
  options: DropdownOption[];
  children: React.ReactNode;
  disabled?: boolean;
}

export function ContextMenu({ options, children, disabled = false }: ContextMenuProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPosition(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div onContextMenu={handleContextMenu}>
      {children}
      {position && (
        <div
          ref={ref}
          style={{ top: position.y, left: position.x }}
          className="fixed z-50 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.label}
                disabled={opt.disabled}
                onClick={() => {
                  opt.onClick();
                  setPosition(null);
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