"use client";

import { useState } from "react";
import { BoardColumn as BoardColumnType } from "@/lib/types";
import Card from "./Card";
import AddCardForm from "./AddCardForm";

interface ColumnProps {
  column: BoardColumnType;
  onDrop: (itemId: string, sourceColumnId: string, targetColumnId: string) => void;
  onAddItem: (columnId: string, title: string) => void;
}

export default function Column({ column, onDrop, onAddItem }: ColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex w-72 shrink-0 flex-col border border-border ${
        dragOver ? "bg-gray-50" : "bg-transparent"
      } transition-colors`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData("application/json"));
          if (data.sourceColumnId !== column.id) {
            onDrop(data.itemId, data.sourceColumnId, column.id);
          }
        } catch {
          // ignore invalid drag data
        }
      }}
    >
      <div className="border-b border-border px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
          {column.name}
        </span>
        <span className="ml-2 text-[10px] text-muted">{column.items.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {column.items.map((item) => (
          <Card key={item.id} item={item} columnId={column.id} />
        ))}
        <AddCardForm onAdd={(title) => onAddItem(column.id, title)} />
      </div>
    </div>
  );
}
