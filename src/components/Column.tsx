"use client";

import { useRef, useState } from "react";
import { BoardColumn as BoardColumnType, BoardItem } from "@/lib/types";
import Card from "./Card";
import AddCardForm from "./AddCardForm";
import { FilterOption } from "./FilterDropdown";

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
  onDrop: (itemId: string, sourceColumnId: string, targetColumnId: string, targetIndex?: number) => void;
  onAddItem: (columnId: string, title: string, assigneeIds: string[], clientId: string | null) => void;
  onDeleteItem: (itemId: string, columnId: string) => void;
  onRenameItem: (itemId: string, newTitle: string) => void;
  onCardClick?: (item: BoardItem) => void;
  onHide?: () => void;
  collapsed?: boolean;
  onUnhide?: () => void;
  clientColorMap?: Map<string, { bg: string; text: string }>;
  assigneeOptions?: FilterOption[];
  clientOptions?: FilterOption[];
}

export default function Column({ column, colorIndex = 0, onDrop, onAddItem, onDeleteItem, onRenameItem, onCardClick, onHide, collapsed, onUnhide, clientColorMap, assigneeOptions, clientOptions }: ColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const colors = COLUMN_COLORS[colorIndex % COLUMN_COLORS.length];

  const calcDropIndex = (clientY: number): number => {
    if (!listRef.current) return column.items.length;
    const cards = listRef.current.querySelectorAll("[data-card-id]");
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) return i;
    }
    return cards.length;
  };

  if (collapsed) {
    return (
      <div
        className="flex w-16 shrink-0 flex-col items-center rounded-xl py-3 gap-2 cursor-pointer group"
        style={{ backgroundColor: colors.bg }}
        onClick={onUnhide}
        title="Click to unhide"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: colors.header }}
        >
          {column.items.length}
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider text-center"
          style={{ color: colors.header, writingMode: "vertical-lr" }}
        >
          {column.name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`group/col flex w-72 shrink-0 flex-col rounded-xl transition-colors ${
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
        setDropIndex(calcDropIndex(e.clientY));
      }}
      onDragLeave={() => {
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setDragOver(false);
          setDropIndex(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setDragOver(false);
        const currentDropIndex = dropIndex;
        setDropIndex(null);
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain"));
          onDrop(data.itemId, data.sourceColumnId, column.id, currentDropIndex ?? undefined);
        } catch {
          // ignore invalid drag data
        }
      }}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: colors.header }}
        >
          {column.name}
          <span className="text-white/70">{column.items.length}</span>
        </span>
        {onHide && (
          <button
            onClick={onHide}
            className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover/col:opacity-100"
            title="Hide column"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </button>
        )}
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {column.items.map((item, i) => (
          <div key={item.id}>
            {dropIndex === i && dragOver && (
              <div className="h-0.5 rounded-full bg-blue-400 mx-1 mb-1" />
            )}
            <Card
              item={item}
              columnId={column.id}
              clientColorMap={clientColorMap}
              onDelete={() => onDeleteItem(item.id, column.id)}
              onRename={(newTitle) => onRenameItem(item.id, newTitle)}
              onClick={() => onCardClick?.(item)}
            />
          </div>
        ))}
        {dropIndex === column.items.length && dragOver && (
          <div className="h-0.5 rounded-full bg-blue-400 mx-1" />
        )}
        <AddCardForm
          onAdd={(title, assigneeIds, clientId) => onAddItem(column.id, title, assigneeIds, clientId)}
          assigneeOptions={assigneeOptions}
          clientOptions={clientOptions}
        />
      </div>
    </div>
  );
}
