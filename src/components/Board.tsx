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
    targetColumnId: string,
    targetIndex?: number
  ) => {
    // Same-column reorder (local only, Slack has no ordering API)
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
      if (targetIndex !== undefined) {
        tgtCol.items.splice(targetIndex, 0, item);
      } else {
        tgtCol.items.push(item);
      }
      return next;
    });

    // Fire-and-forget API call
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
      setColumns(prevColumns);
      setError("Failed to move item. Reverted.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleDeleteItem = async (itemId: string, columnId: string) => {
    // Optimistic removal
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

    try {
      const res = await fetch(
        `/api/lists/${data.listId}/items/${itemId}?workspaceId=${workspaceId}`,
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
    // Optimistic rename
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
        `/api/lists/${data.listId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, cells }),
        }
      );

      if (!res.ok) throw new Error("Rename failed");
    } catch {
      onRefresh();
      setError("Failed to rename item.");
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
            onDeleteItem={handleDeleteItem}
            onRenameItem={handleRenameItem}
          />
        ))}
      </div>
    </div>
  );
}
