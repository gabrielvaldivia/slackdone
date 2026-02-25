"use client";

import { useRef, useState } from "react";
import { BoardItem } from "@/lib/types";

interface CardProps {
  item: BoardItem;
  columnId: string;
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

export default function Card({ item, columnId, onDelete, onRename, onClick }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const isDragging = useRef(false);
  const assignees = item.assignees || [];

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
        const payload = JSON.stringify({ itemId: item.id, sourceColumnId: columnId });
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

      {/* Assignee avatars */}
      {assignees.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
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
  );
}
