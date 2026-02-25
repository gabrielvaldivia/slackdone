"use client";

import { useEffect, useState } from "react";
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

  // Keep local columns in sync with server data
  useEffect(() => {
    setColumns(data.columns);
  }, [data]);

  const handleDrop = async (
    itemId: string,
    sourceColumnId: string,
    targetColumnId: string
  ) => {
    // Snapshot for rollback
    const prevColumns = columns.map((col) => ({
      ...col,
      items: [...col.items],
    }));

    // Optimistic update — move card immediately in UI
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

    // Fire-and-forget API call — no refresh needed, auto-refresh will sync
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
      // Rollback on failure
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
        {columns.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            colorIndex={index}
            onDrop={handleDrop}
            onAddItem={handleAddItem}
          />
        ))}
      </div>
    </div>
  );
}
