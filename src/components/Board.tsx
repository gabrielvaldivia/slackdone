"use client";

import { useEffect, useMemo, useState } from "react";
import { UnifiedBoardData, BoardColumn as BoardColumnType, BoardItem } from "@/lib/types";
import Column from "./Column";
import CardDetailModal from "./CardDetailModal";
import FilterDropdown, { FilterOption } from "./FilterDropdown";
import { BADGE_COLORS, getClientName } from "./Card";

interface BoardProps {
  data: UnifiedBoardData;
  onRefresh: () => void;
}

const HIDDEN_KEY = "slackdone:hiddenColumns";
const MINIMIZED_KEY = "slackdone:minimizedColumns";
const ORDER_KEY = "slackdone:columnOrder";

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

function loadMinimized(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MINIMIZED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveMinimized(ids: Set<string>) {
  localStorage.setItem(MINIMIZED_KEY, JSON.stringify([...ids]));
}

function loadColumnOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveColumnOrder(ids: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

function applyColumnOrder(columns: BoardColumnType[], savedOrder: string[]): BoardColumnType[] {
  if (savedOrder.length === 0) return columns;
  const colMap = new Map(columns.map((c) => [c.id, c]));
  const ordered: BoardColumnType[] = [];
  for (const id of savedOrder) {
    const col = colMap.get(id);
    if (col) {
      ordered.push(col);
      colMap.delete(id);
    }
  }
  // Append any new columns not in the saved order
  for (const col of colMap.values()) {
    ordered.push(col);
  }
  return ordered;
}

export default function Board({ data, onRefresh }: BoardProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>(loadColumnOrder);
  const [columns, setColumns] = useState<BoardColumnType[]>(() =>
    applyColumnOrder(data.columns, loadColumnOrder())
  );
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<BoardItem | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(loadHidden);
  const [minimizedColumns, setMinimizedColumns] = useState<Set<string>>(loadMinimized);
  const [showHidden, setShowHidden] = useState(false);
  const [filterAssignees, setFilterAssignees] = useState<Set<string>>(new Set());
  const [filterClients, setFilterClients] = useState<Set<string>>(new Set());
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);

  useEffect(() => {
    setColumns(applyColumnOrder(data.columns, columnOrder));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a map of client name -> unique color, assigned by sorted order
  const clientColorMap = useMemo(() => {
    const names = new Set<string>();
    for (const col of columns) {
      for (const item of col.items) {
        const name = getClientName(item);
        if (name) names.add(name);
      }
    }
    const sorted = [...names].sort();
    const map = new Map<string, { bg: string; text: string }>();
    sorted.forEach((name, i) => {
      map.set(name, BADGE_COLORS[i % BADGE_COLORS.length]);
    });
    return map;
  }, [columns]);

  // Collect unique assignees from all items, merging by display name across workspaces
  const assigneeOptions = useMemo<FilterOption[]>(() => {
    const byName = new Map<string, FilterOption>();
    for (const col of columns) {
      for (const item of col.items) {
        for (const a of item.assignees || []) {
          const name = a.displayName || a.name;
          const key = name.toLowerCase();
          const existing = byName.get(key);
          if (existing) {
            if (!existing.ids!.includes(a.id)) {
              existing.ids!.push(a.id);
            }
            if (!existing.avatar && a.avatar) {
              existing.avatar = a.avatar;
            }
          } else {
            byName.set(key, { id: a.id, name, avatar: a.avatar, ids: [a.id] });
          }
        }
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [columns]);

  // Collect unique client names from all items
  const clientOptions = useMemo<FilterOption[]>(() => {
    const opts: FilterOption[] = [];
    const seen = new Set<string>();
    for (const col of columns) {
      for (const item of col.items) {
        const name = getClientName(item);
        if (name && !seen.has(name)) {
          seen.add(name);
          const color = clientColorMap.get(name);
          opts.push({ id: name, name, badgeColor: color });
        }
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [columns, clientColorMap]);

  // Apply filters to columns
  const applyFilters = useMemo(() => {
    const hasAssigneeFilter = filterAssignees.size > 0;
    const hasClientFilter = filterClients.size > 0;
    if (!hasAssigneeFilter && !hasClientFilter) return columns;

    // Expand selected assignee option IDs to all merged user IDs
    const expandedAssigneeIds = new Set<string>();
    if (hasAssigneeFilter) {
      for (const selectedId of filterAssignees) {
        const opt = assigneeOptions.find((o) => o.id === selectedId);
        if (opt?.ids) {
          for (const uid of opt.ids) expandedAssigneeIds.add(uid);
        } else {
          expandedAssigneeIds.add(selectedId);
        }
      }
    }

    return columns.map((col) => ({
      ...col,
      items: col.items.filter((item) => {
        if (hasAssigneeFilter) {
          const ids = (item.assignees || []).map((a) => a.id);
          if (!ids.some((id) => expandedAssigneeIds.has(id))) return false;
        }
        if (hasClientFilter) {
          const name = getClientName(item);
          if (!filterClients.has(name)) return false;
        }
        return true;
      }),
    }));
  }, [columns, filterAssignees, filterClients, assigneeOptions]);

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

  const minimizeColumn = (id: string) => {
    setMinimizedColumns((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveMinimized(next);
      return next;
    });
  };

  const expandColumn = (id: string) => {
    setMinimizedColumns((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveMinimized(next);
      return next;
    });
  };

  const visibleColumns = applyFilters.filter((c) => !hiddenColumns.has(c.id));
  const hiddenColumnsList = applyFilters.filter((c) => hiddenColumns.has(c.id));
  const hiddenCount = hiddenColumnsList.length;

  // Build a map from client name → list metadata (for auto-targeting on add)
  const clientListMap = useMemo(() => {
    const map = new Map<string, { listId: string; workspaceId: string }>();
    if (!data.lists) return map;
    for (const col of columns) {
      for (const item of col.items) {
        const name = getClientName(item);
        if (name && !map.has(name) && item.sourceListId && item.sourceWorkspaceId) {
          map.set(name, { listId: item.sourceListId, workspaceId: item.sourceWorkspaceId });
        }
      }
    }
    return map;
  }, [columns, data.lists]);

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

  const handleAddItem = async (columnId: string, title: string, assigneeIds: string[] = [], clientId: string | null = null) => {
    // Resolve target list: if client is selected and maps to a list, use that; else first list
    let targetList = data.lists?.[0];
    if (clientId && clientListMap.has(clientId)) {
      const mapped = clientListMap.get(clientId)!;
      const found = data.lists?.find(
        (l) => l.listId === mapped.listId && l.workspaceId === mapped.workspaceId
      );
      if (found) targetList = found;
    }
    if (!targetList) return;

    // Slack items.create uses initial_fields: an array of objects,
    // each with column_id + type-specific key (rich_text, select, user, date).
    // Ref: https://docs.slack.dev/reference/methods/slackLists.items.create/
    const initialFields: Array<Record<string, unknown>> = [];

    // Fetch the list schema to resolve column IDs
    let nameColId: string | null = null;
    try {
      const res = await fetch(
        `/api/lists/${targetList.listId}?workspaceId=${targetList.workspaceId}`
      );
      if (res.ok) {
        const listData = await res.json();
        const schema = listData.schema || [];

        // Title — rich_text format
        const nameCol = schema.find((c: { key: string }) => c.key === "name");
        nameColId = nameCol?.id || null;

        // Status — columnId is the normalized column name (e.g. "to do")
        // from the unified board, so match against opt.name lowercased
        if (targetList.statusColumnId && columnId !== "__none__" && columnId !== "no status") {
          if (listData.statusColumn?.options) {
            for (const opt of listData.statusColumn.options) {
              if (opt.name.toLowerCase().trim() === columnId) {
                initialFields.push({
                  column_id: targetList.statusColumnId,
                  select: [opt.id],
                });
                break;
              }
            }
          }
        }

        // Assignee
        if (assigneeIds.length > 0) {
          const peopleCol = schema.find(
            (c: { type: string }) => c.type === "people" || c.type === "user"
          );
          if (peopleCol) {
            const workspaceUserIds = new Set<string>();
            for (const col of columns) {
              for (const item of col.items) {
                if (item.sourceWorkspaceId === targetList.workspaceId) {
                  for (const a of item.assignees || []) {
                    workspaceUserIds.add(a.id);
                  }
                }
              }
            }

            const resolvedIds: string[] = [];
            for (const selectedId of assigneeIds) {
              const opt = assigneeOptions.find((o) => o.id === selectedId);
              if (opt?.ids) {
                const match = opt.ids.find((uid) => workspaceUserIds.has(uid));
                if (match) resolvedIds.push(match);
                else resolvedIds.push(selectedId);
              } else {
                resolvedIds.push(selectedId);
              }
            }
            initialFields.push({
              column_id: peopleCol.id,
              user: resolvedIds,
            });
          }
        }

        // Client
        if (clientId) {
          const clientCol = schema.find(
            (c: { type: string; label: string }) =>
              (c.type === "select" || c.type === "status") &&
              c.label.toLowerCase() === "client"
          );
          console.log("Client debug:", {
            clientId,
            clientCol: clientCol ? { id: clientCol.id, key: clientCol.key, label: clientCol.label, type: (clientCol as Record<string,unknown>).type, options: clientCol.options } : null,
            allCols: schema.map((c: { id: string; key: string; label: string; type: string }) => ({ id: c.id, key: c.key, label: c.label, type: c.type })),
          });
          if (clientCol?.options) {
            const match = clientCol.options.find(
              (o: { label: string }) => o.label === clientId
            );
            console.log("Client option match:", match);
            if (match) {
              initialFields.push({
                column_id: clientCol.id,
                select: [match.value],
              });
            }
          }
        }
      }
    } catch {
      // proceed with title only
    }

    // Title — always add, use column ID if found, fall back to "name"
    initialFields.unshift({
      column_id: nameColId || "name",
      rich_text: [
        {
          type: "rich_text",
          elements: [
            {
              type: "rich_text_section",
              elements: [{ type: "text", text: title }],
            },
          ],
        },
      ],
    });

    console.log("Creating item with initial_fields:", JSON.stringify(initialFields));

    try {
      const res = await fetch(`/api/lists/${targetList.listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: targetList.workspaceId,
          initialFields,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Create failed:", errData);
        throw new Error("Create failed");
      }
      onRefresh();
    } catch {
      setError("Failed to create item.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleColumnDragStart = (columnId: string) => {
    setDraggingColumnId(columnId);
  };

  const handleColumnDragEnd = () => {
    setDraggingColumnId(null);
  };

  const handleColumnDrop = (targetColumnId: string) => {
    if (!draggingColumnId || draggingColumnId === targetColumnId) return;
    setColumns((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((c) => c.id === draggingColumnId);
      const toIdx = next.findIndex((c) => c.id === targetColumnId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const newOrder = next.map((c) => c.id);
      setColumnOrder(newOrder);
      saveColumnOrder(newOrder);
      return next;
    });
    setDraggingColumnId(null);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {error && (
        <div className="border-b border-border px-4 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {(assigneeOptions.length > 0 || clientOptions.length > 0 || hiddenCount > 0) && (
        <div className="flex items-center gap-2 px-4 pt-3">
          {assigneeOptions.length > 0 && (
            <FilterDropdown
              label="Assignee"
              options={assigneeOptions}
              selected={filterAssignees}
              onChange={setFilterAssignees}
            />
          )}
          {clientOptions.length > 0 && (
            <FilterDropdown
              label="Client"
              options={clientOptions}
              selected={filterClients}
              onChange={setFilterClients}
            />
          )}
          {hiddenCount > 0 && (
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
          )}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {visibleColumns.map((column) => {
          const originalIndex = columns.findIndex((c) => c.id === column.id);
          const isMinimized = minimizedColumns.has(column.id);
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
              onMinimize={() => minimizeColumn(column.id)}
              onExpand={() => expandColumn(column.id)}
              minimized={isMinimized}
              clientColorMap={clientColorMap}
              assigneeOptions={assigneeOptions}
              clientOptions={clientOptions}
              onColumnDragStart={() => handleColumnDragStart(column.id)}
              onColumnDragEnd={handleColumnDragEnd}
              onColumnDrop={() => handleColumnDrop(column.id)}
              isColumnDragging={draggingColumnId === column.id}
            />
          );
        })}
        {showHidden && hiddenColumnsList.map((column) => {
          const originalIndex = columns.findIndex((c) => c.id === column.id);
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
              clientColorMap={clientColorMap}
              minimized
              onUnhide={() => unhideColumn(column.id)}
              assigneeOptions={assigneeOptions}
              clientOptions={clientOptions}
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
