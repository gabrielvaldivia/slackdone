"use client";

import { BoardItem } from "@/lib/types";

interface CardProps {
  item: BoardItem;
  columnId: string;
}

export default function Card({ item, columnId }: CardProps) {
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
      {item.title}
    </div>
  );
}
