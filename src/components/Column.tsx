"use client";

import { useRef, useState } from "react";
import { BoardColumn as BoardColumnType } from "@/lib/types";
import Card from "./Card";
import AddCardForm from "./AddCardForm";

const COLUMN_COLORS = [
  { bg: "var(--col-0-bg)", header: "var(--col-0)" },
  { bg: "var(--col-1-bg)", header: "var(--col-1)" },
  { bg: "var(--col-2-bg)", header: "var(--col-2)" },
  { bg: "var(--col-3-bg)", header: "var(--col-3)" },
  { bg: "var(--col-4-bg)", header: "var(--col-4)" },
  { bg: "var(--col-5-bg)", header: "var(--col-5)" },
  { bg: "var(--col-6-bg)", header: "var(--col-6)" },
  { bg: "var(--col-7-bg)", header: "var(--col-7)" },
];

interface ColumnProps {
  column: BoardColumnType;
  colorIndex?: number;
  onDrop: (itemId: string, sourceColumnId: string, targetColumnId: string) => void;
  onAddItem: (columnId: string, title: string) => void;
}

export default function Column({ column, colorIndex = 0, onDrop, onAddItem }: ColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const colors = COLUMN_COLORS[colorIndex % COLUMN_COLORS.length];

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl transition-colors ${
        dragOver ? "ring-2 ring-blue-300" : ""
      }`}
      style={{ backgroundColor: colors.bg }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current++;
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => {
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setDragOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (data.sourceColumnId !== column.id) {
            onDrop(data.itemId, data.sourceColumnId, column.id);
          }
        } catch {
          // ignore invalid drag data
        }
      }}
    >
      <div className="px-3 py-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: colors.header }}
        >
          {column.name}
          <span className="text-white/70">{column.items.length}</span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {column.items.map((item) => (
          <Card key={item.id} item={item} columnId={column.id} />
        ))}
        <AddCardForm onAdd={(title) => onAddItem(column.id, title)} />
      </div>
    </div>
  );
}
