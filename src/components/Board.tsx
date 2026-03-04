"use client";

import { useEffect, useState } from "react";
import { UnifiedBoardData, BoardColumn as BoardColumnType, BoardItem } from "@/lib/types";
import Column from "./Column";
import CardDetailModal from "./CardDetailModal";

interface BoardProps {
  data: UnifiedBoardData;
  onRefresh: () => void;
}

const HIDDEN_KEY = "slackdone:hiddenColumns";

function loadHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveHidden(ids: Set<string>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
}

export default function Board({ data, onRefresh }: BoardProps) {
  const [columns, setColumns] = useState<BoardColumnType[]>(data.columns);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<BoardItem | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(loadHidden);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setColumns(data.columns);
  }, [data]);

  const hideColumn = (id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveHidden(next);
      return next;
    });
  };

  const unhideColumn = (id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveHidden(next);
      return next;
    });
  };

  const visibleColumns = columns.filter((c) => !hiddenColumns.has(c.id));
  const hiddenColumnsList = columns.filter((c) => hiddenColumns.has(c.id));
  const hiddenCount = hiddenColumnsList.length;

  // Keep selectedItem in sync when columns update
  useEffect(() => {
    if (!selectedItem) return;
    const itemId = selectedItem.id;
    for (const col of columns) {
      const found = col.items.find((i) => i.id === itemId);
      if (found && found !== selectedItem) {
        setSelectedItem(found);
        return;
      }
    }
  }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find the list metadata for an item (to get its statusColumnId)
  const getListMeta = (item: BoardItem) => {
    return data.lists?.find(
      (l) =>
        l.listId === item.sourceListId &&
        l.workspaceId === item.sourceWorkspaceId
    );
  };

  const handleDrop = async (
    itemId: string,
    sourceColumnId: string,
    targetColumnId: string,
    targetIndex?: number
  ) => {
    // Find the item to get its source info
    let draggedItem: BoardItem | undefined;
    for (const col of columns) {
      draggedItem = col.items.find((i) => i.id === itemId);
      if (draggedItem) break;
    }
    if (!draggedItem) return;

    // Same-column reorder (local only)
    if (sourceColumnId === targetColumnId && targetIndex !== undefined) {
      setColumns((prev) => {
        const next = prev.map((col) => ({ ...col, items: [...col.items] }));
        const col = next.find((c) => c.id === sourceColumnId);
        if (!col) return prev;
        const itemIdx = col.items.findIndex((i) => i.id === itemId);
        if (itemIdx < 0) return prev;
        const [item] = col.items.splice(itemIdx, 1);
        const insertAt = targetIndex > itemIdx ? targetIndex - 1 : targetIndex;
        col.items.splice(insertAt, 0, item);
        return next;
      });
      return;
    }

    const prevColumns = columns.map((col) => ({
      ...col,
      items: [...col.items],
    }));

    // Optimistic update
    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, items: [...col.items] }));
      const srcCol = next.find((c) => c.id === sourceColumnId);
      const tgtCol = next.find((c) => c.id === targetColumnId);
      if (!srcCol || !tgtCol) return prev;

      const itemIdx = srcCol.items.findIndex((i) => i.id === itemId);
      if (itemIdx < 0) return prev;

      const [item] = srcCol.items.splice(itemIdx, 1);
      item.statusValue = targetColumnId;
      if (targetIndex !== undefined) {
        tgtCol.items.splice(targetIndex, 0, item);
      } else {
        tgtCol.items.push(item);
      }
      return next;
    });

    // Route to the correct workspace/list
    try {
      const listMeta = getListMeta(draggedItem);
      if (!listMeta?.statusColumnId) return;

      // Find the actual option ID for this column in the source list
      // The column id in unified board is a normalized name; we need the original option value
      // For "__none__" we clear the select
      // For named columns, we need to find the matching option in the item's source list
      const targetOptionId = await resolveStatusOptionId(
        draggedItem,
        targetColumnId
      );

      const cells = [
        {
          column_id: listMeta.statusColumnId,
          select: targetOptionId === "__none__" ? [] : [targetOptionId],
        },
      ];

      const res = await fetch(
        `/api/lists/${draggedItem.sourceListId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: draggedItem.sourceWorkspaceId,
            cells,
          }),
        }
      );

      if (!res.ok) throw new Error("Update failed");
      setError("");
    } catch {
      setColumns(prevColumns);
      setError("Failed to move item. Reverted.");
      setTimeout(() => setError(""), 3000);
    }
  };

  // Resolve a unified column id (normalized name) to the actual status option id
  // for a specific item's source list
  const resolveStatusOptionId = async (
    item: BoardItem,
    columnId: string
  ): Promise<string> => {
    if (columnId === "__none__" || columnId === "no status") return "__none__";

    // The item's fields contain the status field with options from its source list.
    // Try to find the original status option by matching the normalized column name.
    // First check if columnId directly matches an option value (original non-merged case)
    const statusField = item.fields?.find(
      (f) => f.type === "select" || f.type === "status"
    );
    if (statusField) {
      // The schema has options, check if any match this column name
      const schemaField = data.schema?.find(
        (s) => s.id === statusField.columnId || s.key === statusField.key
      );
      if (schemaField?.options) {
        const match = schemaField.options.find(
          (o) => o.label.toLowerCase().trim() === columnId
        );
        if (match) return match.value;
      }
    }

    // Fallback: fetch the list to get its schema and find the matching option
    try {
      const res = await fetch(
        `/api/lists/${item.sourceListId}?workspaceId=${item.sourceWorkspaceId}`
      );
      if (res.ok) {
        const listData = await res.json();
        if (listData.statusColumn?.options) {
          for (const opt of listData.statusColumn.options) {
            if (opt.name.toLowerCase().trim() === columnId) {
              return opt.id;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return columnId;
  };

  const handleDeleteItem = async (itemId: string, columnId: string) => {
    // Find the item for source info
    let targetItem: BoardItem | undefined;
    for (const col of columns) {
      targetItem = col.items.find((i) => i.id === itemId);
      if (targetItem) break;
    }
    if (!targetItem) return;

    const prevColumns = columns.map((col) => ({
      ...col,
      items: [...col.items],
    }));

    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, items: [...col.items] }));
      const col = next.find((c) => c.id === columnId);
      if (col) {
        col.items = col.items.filter((i) => i.id !== itemId);
      }
      return next;
    });

    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }

    try {
      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}?workspaceId=${targetItem.sourceWorkspaceId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setColumns(prevColumns);
      setError("Failed to delete item. Reverted.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleRenameItem = async (itemId: string, newTitle: string) => {
    let targetItem: BoardItem | undefined;
    for (const col of columns) {
      targetItem = col.items.find((i) => i.id === itemId);
      if (targetItem) break;
    }
    if (!targetItem) return;

    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        items: col.items.map((item) =>
          item.id === itemId ? { ...item, title: newTitle } : item
        ),
      }))
    );

    try {
      const cells = [
        {
          column_id: "name",
          value: JSON.stringify([
            {
              type: "rich_text_section",
              elements: [{ type: "text", text: newTitle }],
            },
          ]),
        },
      ];

      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: targetItem.sourceWorkspaceId,
            cells,
          }),
        }
      );

      if (!res.ok) throw new Error("Rename failed");
    } catch {
      onRefresh();
      setError("Failed to rename item.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleUpdateField = async (
    itemId: string,
    columnId: string,
    value: unknown
  ) => {
    let targetItem: BoardItem | undefined;
    for (const col of columns) {
      targetItem = col.items.find((i) => i.id === itemId);
      if (targetItem) break;
    }
    if (!targetItem) return;

    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        items: col.items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            fields: item.fields?.map((f) =>
              f.columnId === columnId
                ? { ...f, value, displayValue: String(value ?? "") }
                : f
            ),
          };
        }),
      }))
    );

    try {
      const cell: Record<string, unknown> = { column_id: columnId };
      if (Array.isArray(value)) {
        cell.select = value;
      } else if (typeof value === "string") {
        cell.value = value;
      } else if (typeof value === "number") {
        cell.number = value;
      }

      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: targetItem.sourceWorkspaceId,
            cells: [cell],
          }),
        }
      );

      if (!res.ok) throw new Error("Update field failed");
    } catch {
      onRefresh();
      setError("Failed to update field.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleAddItem = async (columnId: string, title: string) => {
    // For adding items in unified view, we need to pick a list.
    // Use the first list that has this status column option, or the first list overall.
    const targetList = data.lists?.[0];
    if (!targetList) return;

    const fields: Record<string, unknown> = { title };

    if (targetList.statusColumnId && columnId !== "__none__" && columnId !== "no status") {
      // Resolve the column name back to an option ID for this list
      try {
        const res = await fetch(
          `/api/lists/${targetList.listId}?workspaceId=${targetList.workspaceId}`
        );
        if (res.ok) {
          const listData = await res.json();
          if (listData.statusColumn?.options) {
            for (const opt of listData.statusColumn.options) {
              if (opt.name.toLowerCase().trim() === columnId) {
                fields[targetList.statusColumnId] = { id: opt.id };
                break;
              }
            }
          }
        }
      } catch {
        // ignore, create without status
      }
    }

    try {
      const res = await fetch(`/api/lists/${targetList.listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: targetList.workspaceId,
          fields,
        }),
      });

      if (!res.ok) throw new Error("Create failed");
      onRefresh();
    } catch {
      setError("Failed to create item.");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {error && (
        <div className="border-b border-border px-4 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {showHidden ? (
                <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
              ) : (
                <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
              )}
            </svg>
            {showHidden ? "Hide" : "Show"} {hiddenCount} hidden
          </button>
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {visibleColumns.map((column) => {
          const originalIndex = columns.indexOf(column);
          return (
            <Column
              key={column.id}
              column={column}
              colorIndex={originalIndex}
              onDrop={handleDrop}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onRenameItem={handleRenameItem}
              onCardClick={setSelectedItem}
              onHide={() => hideColumn(column.id)}
            />
          );
        })}
        {showHidden && hiddenColumnsList.map((column) => {
          const originalIndex = columns.indexOf(column);
          return (
            <Column
              key={column.id}
              column={column}
              colorIndex={originalIndex}
              onDrop={handleDrop}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onRenameItem={handleRenameItem}
              onCardClick={setSelectedItem}
              collapsed
              onUnhide={() => unhideColumn(column.id)}
            />
          );
        })}
      </div>

      {selectedItem && (
        <CardDetailModal
          item={selectedItem}
          schema={data.schema || []}
          onClose={() => setSelectedItem(null)}
          onRename={(newTitle) => handleRenameItem(selectedItem.id, newTitle)}
          onUpdateField={(columnId, value) =>
            handleUpdateField(selectedItem.id, columnId, value)
          }
        />
      )}
    </div>
  );
}
