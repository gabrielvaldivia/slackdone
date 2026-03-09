"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  onMinimize?: () => void;
  onExpand?: () => void;
  minimized?: boolean;
  onUnhide?: () => void;
  clientColorMap?: Map<string, { bg: string; text: string }>;
  assigneeOptions?: FilterOption[];
  clientOptions?: FilterOption[];
  defaultAssignees?: Set<string>;
  defaultClient?: string | null;
  visibleProperties?: Set<string>;
  showClient?: boolean;
  onColumnDragStart?: () => void;
  onColumnDragEnd?: () => void;
  onColumnDrop?: () => void;
  isColumnDragging?: boolean;
  readOnly?: boolean;
}

export default function Column({ column, colorIndex = 0, onDrop, onAddItem, onDeleteItem, onRenameItem, onCardClick, onHide, onMinimize, onExpand, minimized, onUnhide, clientColorMap, assigneeOptions, clientOptions, defaultAssignees, defaultClient, visibleProperties, showClient, onColumnDragStart, onColumnDragEnd, onColumnDrop, isColumnDragging, readOnly }: ColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const [columnDragOver, setColumnDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [topFormOpen, setTopFormOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const colDragCounter = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const colors = COLUMN_COLORS[colorIndex % COLUMN_COLORS.length];

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

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

  if (minimized) {
    return (
      <div
        className={`snap-center flex w-16 shrink-0 flex-col items-center rounded-xl py-3 gap-2 cursor-pointer group transition-colors ${
          dragOver ? "ring-2 ring-blue-300" : ""
        }`}
        style={{ backgroundColor: colors.bg }}
        onClick={() => {
          if (onUnhide) onUnhide();
          else if (onExpand) onExpand();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!e.dataTransfer.types.includes("application/column-drag")) {
            dragCounter.current++;
            setDragOver(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={(e) => {
          if (!e.dataTransfer.types.includes("application/column-drag")) {
            dragCounter.current--;
            if (dragCounter.current === 0) setDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!e.dataTransfer.types.includes("application/column-drag")) {
            dragCounter.current = 0;
            setDragOver(false);
            try {
              const data = JSON.parse(e.dataTransfer.getData("text/plain"));
              onDrop(data.itemId, data.sourceColumnId, column.id);
            } catch {
              // ignore invalid drag data
            }
          }
        }}
        title={onUnhide ? "Click to unhide" : "Click to expand"}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: colors.header }}
        >
          {column.items.length > 99 ? "99+" : column.items.length}
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
      className={`snap-center group/col flex w-72 shrink-0 flex-col rounded-xl transition-colors ${
        dragOver ? "ring-2 ring-blue-300" : ""
      } ${columnDragOver ? "ring-2 ring-purple-300" : ""} ${isColumnDragging ? "opacity-50" : ""}`}
      style={{ backgroundColor: colors.bg }}
      onDragEnter={(e) => {
        e.preventDefault();
        const types = e.dataTransfer.types;
        if (types.includes("application/column-drag")) {
          colDragCounter.current++;
          setColumnDragOver(true);
        } else {
          dragCounter.current++;
          setDragOver(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!e.dataTransfer.types.includes("application/column-drag")) {
          setDropIndex(calcDropIndex(e.clientY));
        }
      }}
      onDragLeave={(e) => {
        if (e.dataTransfer.types.includes("application/column-drag")) {
          colDragCounter.current--;
          if (colDragCounter.current === 0) setColumnDragOver(false);
        } else {
          dragCounter.current--;
          if (dragCounter.current === 0) {
            setDragOver(false);
            setDropIndex(null);
          }
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("application/column-drag")) {
          colDragCounter.current = 0;
          setColumnDragOver(false);
          onColumnDrop?.();
        } else {
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
        }
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-3 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/column-drag", column.id);
          e.dataTransfer.effectAllowed = "move";
          onColumnDragStart?.();
        }}
        onDragEnd={() => {
          onColumnDragEnd?.();
        }}
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: colors.header }}
        >
          {column.name}
          <span className="text-white/70">{column.items.length}</span>
        </span>
        {!readOnly && <div className="flex items-center opacity-30 sm:opacity-0 transition-opacity group-hover/col:opacity-30 hover:opacity-50">
          <button
            onClick={() => setTopFormOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded"
            title="Add item"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        {(onHide || onMinimize) && (
          <div>
            <button
              ref={menuBtnRef}
              onClick={() => {
                const rect = menuBtnRef.current?.getBoundingClientRect();
                if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setMenuOpen((v) => !v);
              }}
              className="flex h-6 w-6 items-center justify-center rounded"
              title="Column options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menuOpen && createPortal(
              <div
                ref={menuRef}
                className="fixed z-50 min-w-[140px] rounded-lg ring-1 ring-border bg-white py-1 shadow-lg"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                {onMinimize && (
                  <button
                    onClick={() => { onMinimize(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                    Minimize
                  </button>
                )}
                {onHide && (
                  <button
                    onClick={() => { onHide(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    Hide
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        )}
        </div>}
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pt-1 pb-2">
        {!readOnly && topFormOpen && (
          <AddCardForm
            onAdd={(title, assigneeIds, clientId) => {
              onAddItem(column.id, title, assigneeIds, clientId);
              setTopFormOpen(false);
            }}
            assigneeOptions={assigneeOptions}
            clientOptions={clientOptions}
            defaultAssignees={defaultAssignees}
            defaultClient={defaultClient}
            autoOpen
            onCancel={() => setTopFormOpen(false)}
          />
        )}
        {column.items.map((item, i) => (
          <div key={item.id}>
            {dropIndex === i && dragOver && (
              <div className="h-0.5 rounded-full bg-blue-400 mx-1 mb-1" />
            )}
            <Card
              item={item}
              columnId={column.id}
              clientColorMap={clientColorMap}
              visibleProperties={visibleProperties}
              showClient={showClient}
              onDelete={() => onDeleteItem(item.id, column.id)}
              onRename={(newTitle) => onRenameItem(item.id, newTitle)}
              onClick={() => onCardClick?.(item)}
            />
          </div>
        ))}
        {dropIndex === column.items.length && dragOver && (
          <div className="h-0.5 rounded-full bg-blue-400 mx-1" />
        )}
        {!readOnly && (
          <AddCardForm
            onAdd={(title, assigneeIds, clientId) => onAddItem(column.id, title, assigneeIds, clientId)}
            assigneeOptions={assigneeOptions}
            clientOptions={clientOptions}
            defaultAssignees={defaultAssignees}
            defaultClient={defaultClient}
          />
        )}
      </div>
    </div>
  );
}
