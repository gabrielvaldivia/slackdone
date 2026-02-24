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
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ itemId: item.id, sourceColumnId: columnId })
        );
        e.dataTransfer.effectAllowed = "move";
        (e.target as HTMLElement).style.opacity = "0.5";
      }}
      onDragEnd={(e) => {
        (e.target as HTMLElement).style.opacity = "1";
      }}
      className="cursor-grab border border-border bg-white p-3 text-sm hover:border-foreground/30 transition-colors active:cursor-grabbing"
    >
      {item.title}
    </div>
  );
}
