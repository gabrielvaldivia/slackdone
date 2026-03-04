"use client";

import { useRef, useState } from "react";
import { BoardItem } from "@/lib/types";

interface CardProps {
  item: BoardItem;
  columnId: string;
  clientColorMap?: Map<string, { bg: string; text: string }>;
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

export default function Card({ item, columnId, clientColorMap, onDelete, onRename, onClick }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const isDragging = useRef(false);
  const assignees = item.assignees || [];
  const clientName = getClientName(item);
  const badgeColor = clientName ? clientColorMap?.get(clientName) ?? null : null;

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.title) {
      onRename?.(trimmed);
    }
    setEditing(false);
  };

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
      {/* Delete button */}
      {onDelete && !editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1.5 top-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
        >
          <span className="text-xs leading-none">×</span>
        </button>
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

      {/* Footer: client badge + assignee avatars */}
      <div className="mt-2 flex items-center justify-between">
        {clientName && badgeColor ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium truncate max-w-[120px]"
            style={{ backgroundColor: badgeColor.bg, color: badgeColor.text }}
            title={clientName}
          >
            {clientName}
          </span>
        ) : (
          <span />
        )}
        {assignees.length > 0 && (
          <div className="flex items-center gap-1">
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
    </div>
  );
}
