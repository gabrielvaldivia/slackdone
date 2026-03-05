"use client";

import { useRef, useState, useEffect } from "react";
import { BoardItem } from "@/lib/types";

interface CardProps {
  item: BoardItem;
  columnId: string;
  clientColorMap?: Map<string, { bg: string; text: string }>;
  visibleProperties?: Set<string>;
  onDelete?: () => void;
  onRename?: (newTitle: string) => void;
  onClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const BADGE_COLORS = [
  { bg: "#DBEAFE", text: "#1E40AF" },  // blue
  { bg: "#FDE68A", text: "#92400E" },  // amber
  { bg: "#D1FAE5", text: "#065F46" },  // emerald
  { bg: "#E9D5FF", text: "#6B21A8" },  // purple
  { bg: "#FED7AA", text: "#9A3412" },  // orange
  { bg: "#CFFAFE", text: "#155E75" },  // cyan
  { bg: "#FECDD3", text: "#9F1239" },  // rose
  { bg: "#D9F99D", text: "#3F6212" },  // lime
  { bg: "#C7D2FE", text: "#3730A3" },  // indigo
  { bg: "#FDE047", text: "#713F12" },  // yellow
  { bg: "#FBCFE8", text: "#9D174D" },  // pink
  { bg: "#A7F3D0", text: "#064E3B" },  // teal
];

export function getClientName(item: BoardItem): string {
  const clientField = item.fields?.find(
    (f) => f.label.toLowerCase() === "client"
  );
  if (clientField?.displayValue) return clientField.displayValue;
  return item.workspaceName || "";
}

export default function Card({ item, columnId, clientColorMap, visibleProperties, onDelete, onRename, onClick }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const assignees = item.assignees || [];
  const showAssignees = visibleProperties?.has("assignees") ?? true;

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.title) {
      onRename?.(trimmed);
    }
    setEditing(false);
  };

  // Collect visible field properties (excluding people fields handled by assignees)
  const visibleFields = (item.fields || []).filter((f) => {
    if (f.type === "people" || f.type === "user") return false;
    if (f.key === "todo_completed") return false;
    if (!visibleProperties) return false;
    return visibleProperties.has(f.key);
  });

  const hasFooter = (showAssignees && assignees.length > 0) || visibleFields.length > 0;

  return (
    <div
      data-card-id={item.id}
      draggable={!editing}
      onDragStart={(e) => {
        isDragging.current = true;
        const payload = JSON.stringify({
          itemId: item.id,
          sourceColumnId: columnId,
          sourceWorkspaceId: item.sourceWorkspaceId,
          sourceListId: item.sourceListId,
        });
        e.dataTransfer.setData("text/plain", payload);
        e.dataTransfer.effectAllowed = "move";
        (e.target as HTMLElement).style.opacity = "0.5";
      }}
      onDragEnd={(e) => {
        isDragging.current = false;
        (e.target as HTMLElement).style.opacity = "1";
      }}
      onClick={() => {
        if (!isDragging.current && !editing) {
          onClick?.();
        }
      }}
      onDoubleClick={() => {
        if (!isDragging.current) {
          setEditValue(item.title);
          setEditing(true);
        }
      }}
      className="group relative cursor-grab rounded-lg bg-white p-3 text-sm shadow-sm hover:shadow-md transition-shadow active:cursor-grabbing"
    >
      {/* 3-dot menu */}
      {onDelete && !editing && (
        <div ref={menuRef} className="absolute right-1.5 top-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className={`${menuOpen ? "flex" : "hidden group-hover:flex"} items-center justify-center w-5 h-5 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-50 min-w-[120px] rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Title */}
      {editing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditValue(item.title);
              setEditing(false);
            }
          }}
          autoFocus
          className="w-full bg-transparent outline-none text-sm -m-0.5 p-0.5 rounded border border-blue-300"
        />
      ) : (
        <div className="pr-4">{item.title}</div>
      )}

      {/* Footer: dynamic properties */}
      {hasFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Field properties */}
          {visibleFields.map((field) => {
            if (!field.displayValue) return null;

            // Select/status fields: show as colored badge if possible
            if (field.type === "select" || field.type === "status") {
              const name = field.displayValue;
              const color = clientColorMap?.get(name);
              if (color) {
                return (
                  <span
                    key={field.key}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium truncate max-w-[120px]"
                    style={{ backgroundColor: color.bg, color: color.text }}
                    title={name}
                  >
                    {name}
                  </span>
                );
              }
              return (
                <span
                  key={field.key}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 truncate max-w-[120px]"
                  title={name}
                >
                  {name}
                </span>
              );
            }

            // Date fields
            if (field.type === "date") {
              return (
                <span
                  key={field.key}
                  className="text-[10px] text-gray-500"
                  title={field.label}
                >
                  {field.displayValue}
                </span>
              );
            }

            // Default: small text
            return (
              <span
                key={field.key}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 truncate max-w-[120px]"
                title={`${field.label}: ${field.displayValue}`}
              >
                {field.displayValue}
              </span>
            );
          })}

          {/* Assignee avatars — pushed to the right */}
          {showAssignees && assignees.length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              {assignees.map((user) => (
                <div
                  key={user.id}
                  title={user.displayName}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600 overflow-hidden"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(user.displayName)
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
