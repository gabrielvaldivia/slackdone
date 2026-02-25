"use client";

import { BoardItem } from "@/lib/types";

interface CardProps {
  item: BoardItem;
  columnId: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Card({ item, columnId }: CardProps) {
  const assignees = item.assignees || [];

  return (
    <div
      draggable
      onDragStart={(e) => {
        const payload = JSON.stringify({ itemId: item.id, sourceColumnId: columnId });
        e.dataTransfer.setData("text/plain", payload);
        e.dataTransfer.effectAllowed = "move";
        (e.target as HTMLElement).style.opacity = "0.5";
      }}
      onDragEnd={(e) => {
        (e.target as HTMLElement).style.opacity = "1";
      }}
      className="cursor-grab rounded-lg bg-white p-3 text-sm shadow-sm hover:shadow-md transition-shadow active:cursor-grabbing"
    >
      <div>{item.title}</div>
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
