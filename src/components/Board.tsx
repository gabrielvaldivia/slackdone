"use client";

import { useState } from "react";
import { BoardData, BoardColumn as BoardColumnType } from "@/lib/types";
import Column from "./Column";

interface BoardProps {
  data: BoardData;
  workspaceId: string;
  onRefresh: () => void;
}

export default function Board({ data, workspaceId, onRefresh }: BoardProps) {
  const [columns, setColumns] = useState<BoardColumnType[]>(data.columns);
  const [error, setError] = useState("");

  // Sync when data prop changes
  if (data.columns !== columns && data.listId) {
    // Only update if the data actually changed (new fetch)
    const dataKey = JSON.stringify(data.columns.map((c) => c.items.map((i) => i.id)));
    const colKey = JSON.stringify(columns.map((c) => c.items.map((i) => i.id)));
    if (dataKey !== colKey) {
      setColumns(data.columns);
    }
  }

  const handleDrop = async (
    itemId: string,
    sourceColumnId: string,
    targetColumnId: string
  ) => {
    // Optimistic update
    const prevColumns = columns;
    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, items: [...col.items] }));
      const srcCol = next.find((c) => c.id === sourceColumnId);
      const tgtCol = next.find((c) => c.id === targetColumnId);
      if (!srcCol || !tgtCol) return prev;

      const itemIdx = srcCol.items.findIndex((i) => i.id === itemId);
      if (itemIdx < 0) return prev;

      const [item] = srcCol.items.splice(itemIdx, 1);
      item.statusValue = targetColumnId;
      tgtCol.items.push(item);
      return next;
    });

    // API call
    try {
      if (!data.statusColumn) return;
      const cells = [
        {
          column_id: data.statusColumn.id,
          select: targetColumnId === "__none__" ? [] : [targetColumnId],
        },
      ];

      const res = await fetch(
        `/api/lists/${data.listId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, cells }),
        }
      );

      if (!res.ok) throw new Error("Update failed");
      setError("");
    } catch {
      // Rollback
      setColumns(prevColumns);
      setError("Failed to move item. Reverted.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleAddItem = async (columnId: string, title: string) => {
    const fields: Record<string, unknown> = {
      title: title,
    };

    if (data.statusColumn && columnId !== "__none__") {
      fields[data.statusColumn.id] = { id: columnId };
    }

    try {
      const res = await fetch(`/api/lists/${data.listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, fields }),
      });

      if (!res.ok) throw new Error("Create failed");
      // Refresh board to get the new item with proper ID
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

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            onDrop={handleDrop}
            onAddItem={handleAddItem}
          />
        ))}
      </div>
    </div>
  );
}
