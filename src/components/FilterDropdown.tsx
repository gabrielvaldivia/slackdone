"use client";

import { useEffect, useRef, useState } from "react";

export interface FilterOption {
  id: string;
  name: string;
  avatar?: string;
  badgeColor?: { bg: string; text: string };
  /** When a person exists across multiple workspaces, all their user IDs */
  ids?: string[];
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export default function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const activeCount = selected.size;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          activeCount > 0
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {label}
        {activeCount > 0 && ` (${activeCount})`}
        <svg
          width="10"
          height="10"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No options</div>
          )}
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(opt.id)}
                onChange={() => toggle(opt.id)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
              />
              {opt.avatar ? (
                <img
                  src={opt.avatar}
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
              ) : opt.badgeColor ? (
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: opt.badgeColor.bg }}
                />
              ) : null}
              <span className="truncate">{opt.name}</span>
            </label>
          ))}
          {activeCount > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="mt-1 w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
