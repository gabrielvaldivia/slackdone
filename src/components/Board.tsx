"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const CARD_PROPS_KEY = "slackdone:cardProperties";

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

const VIEWS_KEY = "slackdone:savedViews";

interface SavedView {
  id: string;
  name: string;
  assignees: string[];
  clients: string[];
}

function loadViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveViews(views: SavedView[]) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
}

function loadCardProperties(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CARD_PROPS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCardProperties(keys: string[]) {
  localStorage.setItem(CARD_PROPS_KEY, JSON.stringify(keys));
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignees, setFilterAssignees] = useState<Set<string>>(new Set());
  const [filterClients, setFilterClients] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadViews);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState<string | null>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [visibleCardProps, setVisibleCardProps] = useState<string[] | null>(loadCardProperties);
  const propsRef = useRef<HTMLDivElement>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);

  useEffect(() => {
    setColumns(applyColumnOrder(data.columns, columnOrder));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all available card properties from items
  // "assignees" is a virtual property for people fields
  const availableCardProps = useMemo(() => {
    const props = new Map<string, { key: string; label: string; type: string }>();
    props.set("assignees", { key: "assignees", label: "Assignees", type: "people" });
    for (const col of columns) {
      for (const item of col.items) {
        for (const field of item.fields || []) {
          if (field.type === "people" || field.type === "user") continue; // covered by "assignees"
          if (field.type === "unknown") continue;
          if (field.key === "todo_completed") continue;
          if (!props.has(field.key)) {
            props.set(field.key, { key: field.key, label: field.label, type: field.type });
          }
        }
      }
    }
    return [...props.values()];
  }, [columns]);

  // Effective visible properties: use saved or default to client + assignees
  const effectiveCardProps = useMemo(() => {
    if (visibleCardProps !== null) return new Set(visibleCardProps);
    // Default: show assignees + any field labeled "client"
    const defaults = new Set<string>(["assignees"]);
    for (const prop of availableCardProps) {
      if (prop.label.toLowerCase() === "client") defaults.add(prop.key);
    }
    return defaults;
  }, [visibleCardProps, availableCardProps]);

  // Close props dropdown on outside click
  useEffect(() => {
    if (!propsOpen) return;
    const handler = (e: MouseEvent) => {
      if (propsRef.current && !propsRef.current.contains(e.target as Node)) {
        setPropsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [propsOpen]);

  const toggleCardProp = (key: string) => {
    const current = new Set(effectiveCardProps);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    const arr = [...current];
    setVisibleCardProps(arr);
    saveCardProperties(arr);
  };

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

  // Apply filters and search to columns
  const applyFilters = useMemo(() => {
    const hasAssigneeFilter = filterAssignees.size > 0;
    const hasClientFilter = filterClients.size > 0;
    const query = searchQuery.toLowerCase().trim();
    const hasSearch = query.length > 0;
    if (!hasAssigneeFilter && !hasClientFilter && !hasSearch) return columns;

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
        if (hasSearch) {
          const title = item.title.toLowerCase();
          const assigneeNames = (item.assignees || [])
            .map((a) => (a.displayName || a.name).toLowerCase())
            .join(" ");
          const clientName = getClientName(item).toLowerCase();
          if (!title.includes(query) && !assigneeNames.includes(query) && !clientName.includes(query)) {
            return false;
          }
        }
        return true;
      }),
    }));
  }, [columns, filterAssignees, filterClients, assigneeOptions, searchQuery]);

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

  const hasActiveFilters = filterAssignees.size > 0 || filterClients.size > 0;

  // Check if current filters differ from the active saved view
  const filtersMatchActiveView = useMemo(() => {
    if (!activeViewId) return false;
    const view = savedViews.find((v) => v.id === activeViewId);
    if (!view) return false;
    const viewAssignees = new Set(view.assignees);
    const viewClients = new Set(view.clients);
    if (filterAssignees.size !== viewAssignees.size || filterClients.size !== viewClients.size) return false;
    for (const id of filterAssignees) if (!viewAssignees.has(id)) return false;
    for (const id of filterClients) if (!viewClients.has(id)) return false;
    return true;
  }, [activeViewId, savedViews, filterAssignees, filterClients]);

  const showSaveView = hasActiveFilters && !filtersMatchActiveView;

  const handleSaveView = useCallback(() => {
    const name = viewName.trim();
    if (!name) return;
    const view: SavedView = {
      id: Date.now().toString(),
      name,
      assignees: [...filterAssignees],
      clients: [...filterClients],
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    saveViews(next);
    setActiveViewId(view.id);
    setSavingView(false);
    setViewName("");
  }, [viewName, filterAssignees, filterClients, savedViews]);

  const handleLoadView = (view: SavedView) => {
    if (activeViewId === view.id) {
      setFilterAssignees(new Set());
      setFilterClients(new Set());
      setActiveViewId(null);
    } else {
      setFilterAssignees(new Set(view.assignees));
      setFilterClients(new Set(view.clients));
      setActiveViewId(view.id);
    }
  };

  const handleDeleteView = (id: string) => {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    saveViews(next);
    if (activeViewId === id) setActiveViewId(null);
    setViewMenuOpen(null);
  };

  // Close view context menu on outside click
  useEffect(() => {
    if (!viewMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [viewMenuOpen]);

  // Focus save input when it appears
  useEffect(() => {
    if (savingView) saveInputRef.current?.focus();
  }, [savingView]);

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
      // Determine the field type to use the right cell key
      const fieldDef = targetItem.fields?.find((f) => f.columnId === columnId);
      const fieldType = fieldDef?.type;
      if (fieldType === "people" && Array.isArray(value)) {
        cell.user = value;
      } else if (Array.isArray(value)) {
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

  const handleUpdateAssignees = async (itemId: string, userIds: string[]) => {
    let targetItem: BoardItem | undefined;
    for (const col of columns) {
      targetItem = col.items.find((i) => i.id === itemId);
      if (targetItem) break;
    }
    if (!targetItem) return;

    const peopleField = targetItem.fields?.find((f) => f.type === "people" || f.type === "user");
    if (!peopleField) return;

    // Resolve cross-workspace user IDs to the correct workspace
    const workspaceUserIds = new Set<string>();
    for (const col of columns) {
      for (const item of col.items) {
        if (item.sourceWorkspaceId === targetItem!.sourceWorkspaceId) {
          for (const a of item.assignees || []) {
            workspaceUserIds.add(a.id);
          }
        }
      }
    }

    const resolvedIds: string[] = [];
    for (const uid of userIds) {
      // If this ID already belongs to the right workspace, use it directly
      if (workspaceUserIds.has(uid)) {
        resolvedIds.push(uid);
        continue;
      }
      // Otherwise, find the merged option and resolve to the correct workspace ID
      const opt = assigneeOptions.find((o) => o.id === uid || o.ids?.includes(uid));
      if (opt?.ids) {
        const match = opt.ids.find((id) => workspaceUserIds.has(id));
        if (match) {
          resolvedIds.push(match);
          continue;
        }
      }
      resolvedIds.push(uid);
    }

    // Build updated assignees from the known assignee options
    const updatedAssignees = resolvedIds.map((uid) => {
      const existing = targetItem!.assignees?.find((a) => a.id === uid);
      if (existing) return existing;
      const opt = assigneeOptions.find((o) => o.id === uid || o.ids?.includes(uid));
      return {
        id: uid,
        name: opt?.name || uid,
        displayName: opt?.name || uid,
        avatar: opt?.avatar || "",
      };
    });

    // Optimistic update
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        items: col.items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            assignees: updatedAssignees,
            fields: item.fields?.map((f) =>
              f.columnId === peopleField.columnId
                ? { ...f, value: resolvedIds, displayValue: updatedAssignees.map((a) => a.displayName).join(", ") }
                : f
            ),
          };
        }),
      }))
    );

    try {
      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: targetItem.sourceWorkspaceId,
            cells: [{ column_id: peopleField.columnId, user: resolvedIds }],
          }),
        }
      );
      if (!res.ok) throw new Error("Update assignees failed");
    } catch {
      onRefresh();
      setError("Failed to update assignees.");
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

      <div className="flex flex-col gap-2 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 w-44 rounded-full border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full pl-3 py-1 text-xs font-medium transition-colors ${
              hasActiveFilters && !filtersOpen ? "pr-1.5" : "pr-3"
            } ${
              filtersOpen || hasActiveFilters
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="8" y1="18" x2="16" y2="18" />
            </svg>
            Filter
            {hasActiveFilters && !filtersOpen && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white">
                {filterAssignees.size + filterClients.size}
              </span>
            )}
          </button>

          {/* Properties toggle */}
          <div className="relative" ref={propsRef}>
            <button
              onClick={() => setPropsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                propsOpen
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Properties
            </button>
            {propsOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {availableCardProps.map((prop) => (
                  <label
                    key={prop.key}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={effectiveCardProps.has(prop.key)}
                      onChange={() => toggleCardProp(prop.key)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    <span className="truncate">{prop.label}</span>
                    <span className="ml-auto text-[10px] text-gray-400">{prop.type}</span>
                  </label>
                ))}
                {availableCardProps.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No properties available</div>
                )}
              </div>
            )}
          </div>

          {/* Saved view pills */}
          {savedViews.map((view) => (
            <div key={view.id} className="relative" ref={viewMenuOpen === view.id ? viewMenuRef : undefined}>
              <button
                onClick={() => handleLoadView(view)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setViewMenuOpen(view.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeViewId === view.id
                    ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {view.name}
              </button>
              <button
                onClick={() => setViewMenuOpen(viewMenuOpen === view.id ? null : view.id)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-[8px] text-gray-600 hover:bg-gray-400 group-hover:flex"
                style={{ display: viewMenuOpen === view.id || activeViewId === view.id ? undefined : "none" }}
              >
                &times;
              </button>
              {viewMenuOpen === view.id && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => handleDeleteView(view.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete view
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Save view */}
          {showSaveView && !savingView && (
            <button
              onClick={() => setSavingView(true)}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save view
            </button>
          )}
          {savingView && (
            <form
              className="inline-flex items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); handleSaveView(); }}
            >
              <input
                ref={saveInputRef}
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name..."
                className="h-6 w-32 rounded-full border border-gray-300 px-2.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                onKeyDown={(e) => { if (e.key === "Escape") { setSavingView(false); setViewName(""); } }}
              />
              <button
                type="submit"
                disabled={!viewName.trim()}
                className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setSavingView(false); setViewName(""); }}
                className="rounded-full px-1.5 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Collapsible filter row */}
        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-2">
            {assigneeOptions.length > 0 && (
              <FilterDropdown
                label="Assignee"
                options={assigneeOptions}
                selected={filterAssignees}
                onChange={(v) => { setFilterAssignees(v); setActiveViewId(null); }}
              />
            )}
            {clientOptions.length > 0 && (
              <FilterDropdown
                label="Client"
                options={clientOptions}
                selected={filterClients}
                onChange={(v) => { setFilterClients(v); setActiveViewId(null); }}
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
      </div>

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
              defaultAssignees={filterAssignees.size > 0 ? filterAssignees : undefined}
              defaultClient={filterClients.size === 1 ? [...filterClients][0] : null}
              visibleProperties={effectiveCardProps}
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
              visibleProperties={effectiveCardProps}
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
          onDelete={() => {
            const col = columns.find((c) =>
              c.items.some((i) => i.id === selectedItem.id)
            );
            if (col) handleDeleteItem(selectedItem.id, col.id);
          }}
          assigneeOptions={assigneeOptions}
          onUpdateAssignees={(userIds) =>
            handleUpdateAssignees(selectedItem.id, userIds)
          }
        />
      )}
    </div>
  );
}
