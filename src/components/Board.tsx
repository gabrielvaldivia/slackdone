"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UnifiedBoardData, BoardColumn as BoardColumnType, BoardItem } from "@/lib/types";
import Column from "./Column";
import CardDetailModal from "./CardDetailModal";
import FilterDropdown, { FilterOption } from "./FilterDropdown";
import { BADGE_COLORS, getClientName } from "./Card";
import FadeScroll from "./FadeScroll";
import { toast } from "sonner";

interface BoardProps {
  data: UnifiedBoardData;
  onRefresh: () => void;
  readOnly?: boolean;
  initialView?: { name: string; assignees: string[]; clients: string[]; properties?: string[]; columnOrder?: string[]; minimizedColumns?: string[] };
  shareToken?: string;
  externalSearch?: string;
  onExternalSearchChange?: (query: string) => void;
  isSharedView?: boolean;
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

function loadMinimized(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MINIMIZED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
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

// Save to both localStorage (fast) and backend (persistent)
const ACTIVE_VIEW_KEY = "slackdone:activeViewId";

function saveBoardPreferences(columnOrder: string[], hiddenColumns: Set<string>, minimizedColumns: Set<string>, fieldOrder?: string[], localOnly?: boolean, itemOrder?: Record<string, string[]>, activeViewId?: string | null) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(columnOrder));
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenColumns]));
  localStorage.setItem(MINIMIZED_KEY, JSON.stringify([...minimizedColumns]));
  if (localOnly) return;
  const payload: Record<string, unknown> = {
    columnOrder,
    hiddenColumns: [...hiddenColumns],
    minimizedColumns: [...minimizedColumns],
  };
  payload.fieldOrder = fieldOrder || [];
  payload.itemOrder = itemOrder || {};
  payload.activeViewId = activeViewId ?? null;
  fetch("/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

const VIEWS_KEY = "slackdone:savedViews";

interface SavedView {
  id: string;
  name: string;
  assignees: string[];
  clients: string[];
  filters?: Record<string, string[]>;
  properties?: string[];
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
  fetch("/api/saved-views", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(views),
  }).catch(() => {});
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

function applyItemOrder(columns: BoardColumnType[], savedItemOrder: Record<string, string[]>): BoardColumnType[] {
  if (!savedItemOrder || Object.keys(savedItemOrder).length === 0) return columns;
  return columns.map((col) => {
    const order = savedItemOrder[col.id];
    if (!order || order.length === 0) return col;
    const itemMap = new Map(col.items.map((item) => [item.id, item]));
    const ordered: BoardItem[] = [];
    for (const id of order) {
      const item = itemMap.get(id);
      if (item) {
        ordered.push(item);
        itemMap.delete(id);
      }
    }
    // Append any items not in the saved order (new items)
    for (const item of itemMap.values()) {
      ordered.push(item);
    }
    return { ...col, items: ordered };
  });
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

function ShareDialog({ viewId, onClose }: { viewId: string; onClose: () => void }) {
  const [mode, setMode] = useState<"readonly" | "edit">("readonly");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const generateLink = useCallback(async (m: "readonly" | "edit") => {
    setLoading(true);
    setError("");
    setUrl(null);
    setCopied(false);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewId, mode: m }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      setUrl(`${window.location.origin}${data.url}`);
    } catch {
      setError("Failed to generate link");
    } finally {
      setLoading(false);
    }
  }, [viewId]);

  useEffect(() => {
    generateLink(mode);
  }, [mode, generateLink]);

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Share view</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center">
            <span className="text-sm text-muted-foreground">Anyone with the link can</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "readonly" | "edit")}
              className="ml-1 text-sm font-medium outline-none bg-transparent cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right center", paddingRight: "16px" }}
            >
              <option value="readonly">view</option>
              <option value="edit">edit</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={loading ? "Generating..." : url || ""}
              className="flex-1 rounded-md border border-border px-3 py-2 text-sm bg-gray-50 outline-none text-muted-foreground select-all"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopy}
              disabled={!url || loading}
              className="shrink-0 rounded-md bg-foreground px-4 py-2 text-xs text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Board({ data, onRefresh, readOnly, initialView, shareToken, externalSearch, onExternalSearchChange, isSharedView }: BoardProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>(loadColumnOrder);
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);
  const fieldOrderRef = useRef<string[]>([]);
  const [itemOrder, setItemOrder] = useState<Record<string, string[]>>({});
  const itemOrderRef = useRef<Record<string, string[]>>({});
  const [columns, setColumns] = useState<BoardColumnType[]>(() =>
    applyColumnOrder(data.columns, loadColumnOrder())
  );
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<BoardItem | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(loadHidden);
  const [minimizedColumns, setMinimizedColumns] = useState<Set<string>>(loadMinimized);
  const [showHidden, setShowHidden] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const searchQuery = externalSearch !== undefined ? externalSearch : internalSearch;
  const setSearchQuery = onExternalSearchChange || setInternalSearch;
  const [filterAssignees, setFilterAssignees] = useState<Set<string>>(new Set());
  const [filterClients, setFilterClients] = useState<Set<string>>(new Set());
  const [fieldFilters, setFieldFilters] = useState<Record<string, Set<string>>>({});
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadViews);
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_VIEW_KEY) || null; } catch { return null; }
  });
  const activeViewIdRef = useRef<string | null>(activeViewId);
  const updateActiveViewId = useCallback((id: string | null) => {
    setActiveViewId(id);
    activeViewIdRef.current = id;
    if (id) localStorage.setItem(ACTIVE_VIEW_KEY, id);
    else localStorage.removeItem(ACTIVE_VIEW_KEY);
  }, []);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState<string | null>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuTriggerRef = useRef<HTMLSpanElement>(null);
  const [viewMenuPos, setViewMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [draggingViewId, setDraggingViewId] = useState<string | null>(null);
  const [viewDropTarget, setViewDropTarget] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [visibleCardProps, setVisibleCardProps] = useState<string[] | null>(loadCardProperties);
  const propsButtonRef = useRef<HTMLButtonElement>(null);
  const propsMenuRef = useRef<HTMLDivElement>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [desktopPortal, setDesktopPortal] = useState<HTMLElement | null>(null);

  // Pending optimistic updates buffer — survives data refreshes until server catches up
  const pendingUpdatesRef = useRef<Map<string, { itemId: string; columnId: string; value: unknown; displayValue: string; fieldType?: string; timestamp: number }>>(new Map());

  const applyPendingUpdates = useCallback((cols: BoardColumnType[]): BoardColumnType[] => {
    const pending = pendingUpdatesRef.current;
    if (pending.size === 0) return cols;
    // Purge entries older than 15 seconds
    const now = Date.now();
    for (const [key, entry] of pending) {
      if (now - entry.timestamp > 15000) pending.delete(key);
    }
    if (pending.size === 0) return cols;
    return cols.map((col) => ({
      ...col,
      items: col.items.map((item) => {
        let fields = item.fields;
        let changed = false;
        for (const entry of pending.values()) {
          if (entry.itemId !== item.id) continue;
          // Check if server already has the updated value
          const existing = fields?.find((f) => f.columnId === entry.columnId);
          if (existing && existing.displayValue === entry.displayValue) continue;
          changed = true;
          const found = fields?.some((f) => f.columnId === entry.columnId);
          if (found) {
            fields = fields!.map((f) =>
              f.columnId === entry.columnId ? { ...f, value: entry.value, displayValue: entry.displayValue } : f
            );
          } else {
            const sf = (data.schema || []).find((s) => s.id === entry.columnId || s.key === entry.columnId);
            fields = [...(fields || []), {
              columnId: entry.columnId,
              key: sf?.key || entry.columnId,
              type: entry.fieldType || sf?.type || "unknown",
              label: sf?.label || entry.columnId,
              value: entry.value,
              displayValue: entry.displayValue,
            }];
          }
        }
        return changed ? { ...item, fields } : item;
      }),
    }));
  }, [data.schema]);

  useEffect(() => {
    const newColumns = applyPendingUpdates(applyItemOrder(applyColumnOrder(data.columns, columnOrder), itemOrderRef.current));
    setColumns(newColumns);
    // Keep selectedItem in sync with refreshed data
    setSelectedItem((prev) => {
      if (!prev) return prev;
      for (const col of newColumns) {
        const updated = col.items.find((i) => i.id === prev.id);
        if (updated) return updated;
      }
      return prev;
    });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    if (w.__ELECTRON__ === true || w.__TAURI__ != null || w.__TAURI_APP__ === true) {
      setIsDesktopApp(true);
      const el = document.getElementById("desktop-toolbar-portal");
      if (el) setDesktopPortal(el);
    }
  }, []);

  // Apply initial view filters for shared/read-only boards
  useEffect(() => {
    if (!initialView) return;
    setFilterAssignees(new Set(initialView.assignees || []));
    setFilterClients(new Set(initialView.clients || []));
    if (initialView.properties) {
      setVisibleCardProps(initialView.properties);
    }
    if (initialView.columnOrder?.length) {
      setColumnOrder(initialView.columnOrder);
      columnOrderRef.current = initialView.columnOrder;
      setColumns((prev) => applyColumnOrder(prev, initialView.columnOrder!));
    }
    if (initialView.minimizedColumns?.length) {
      setMinimizedColumns(new Set(initialView.minimizedColumns));
      minimizedColumnsRef.current = new Set(initialView.minimizedColumns);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load board preferences from backend on mount (skip in shared views)
  useEffect(() => {
    if (isSharedView) return;

    fetch("/api/preferences")
      .then((res) => res.ok ? res.json() : null)
      .then((prefs) => {
        if (!prefs) return;
        if (prefs.columnOrder?.length) {
          setColumnOrder(prefs.columnOrder);
          setColumns((prev) => applyColumnOrder(prev, prefs.columnOrder));
          localStorage.setItem(ORDER_KEY, JSON.stringify(prefs.columnOrder));
        }
        if (prefs.hiddenColumns) {
          setHiddenColumns(new Set(prefs.hiddenColumns));
          localStorage.setItem(HIDDEN_KEY, JSON.stringify(prefs.hiddenColumns));
        }
        if (prefs.minimizedColumns) {
          setMinimizedColumns(new Set(prefs.minimizedColumns));
          localStorage.setItem(MINIMIZED_KEY, JSON.stringify(prefs.minimizedColumns));
        }
        if (prefs.fieldOrder?.length) {
          setFieldOrder(prefs.fieldOrder);
          fieldOrderRef.current = prefs.fieldOrder;
        }
        if (prefs.itemOrder && Object.keys(prefs.itemOrder).length > 0) {
          setItemOrder(prefs.itemOrder);
          itemOrderRef.current = prefs.itemOrder;
          setColumns((prev) => applyItemOrder(prev, prefs.itemOrder));
        }
        if (prefs.activeViewId) {
          updateActiveViewId(prefs.activeViewId);
        }
      })
      .catch(() => {});

    // Load saved views from backend
    fetch("/api/saved-views")
      .then((res) => res.ok ? res.json() : null)
      .then((views) => {
        if (views?.length) {
          setSavedViews(views);
          localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore saved view filters on mount
  const viewRestoredRef = useRef(false);
  useEffect(() => {
    if (viewRestoredRef.current || !activeViewId || savedViews.length === 0) return;
    const view = savedViews.find((v) => v.id === activeViewId);
    if (!view) {
      updateActiveViewId(null);
      return;
    }
    viewRestoredRef.current = true;
    setFilterAssignees(new Set(view.assignees));
    setFilterClients(new Set(view.clients));
    const restored: Record<string, Set<string>> = {};
    if (view.filters) {
      for (const [k, v] of Object.entries(view.filters)) {
        if (v.length > 0) restored[k] = new Set(v);
      }
    }
    setFieldFilters(restored);
    if (view.properties) {
      setVisibleCardProps(view.properties);
    }
  }, [savedViews, activeViewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all available card properties from items
  // "assignees" is a virtual property for people fields
  // Group by label+type so the same logical property across lists is shown once
  const availableCardProps = useMemo(() => {
    const groups = new Map<string, { keys: string[]; label: string; type: string }>();
    groups.set("assignees", { keys: ["assignees"], label: "Assignees", type: "people" });
    for (const col of columns) {
      for (const item of col.items) {
        for (const field of item.fields || []) {
          if (field.type === "people" || field.type === "user") continue;
          if (field.type === "unknown") continue;
          if (field.key === "todo_completed") continue;
          const groupKey = `${field.label}::${field.type}`;
          const existing = groups.get(groupKey);
          if (existing) {
            if (!existing.keys.includes(field.key)) existing.keys.push(field.key);
          } else {
            groups.set(groupKey, { keys: [field.key], label: field.label, type: field.type });
          }
        }
      }
    }
    return [...groups.values()];
  }, [columns]);

  // Effective visible properties: use saved or default to client + assignees
  const effectiveCardProps = useMemo(() => {
    if (visibleCardProps !== null) return new Set(visibleCardProps);
    // Default: show assignees + any field labeled "client"
    const defaults = new Set<string>(["assignees"]);
    for (const prop of availableCardProps) {
      if (prop.label.toLowerCase() === "client") {
        for (const k of prop.keys) defaults.add(k);
      }
    }
    return defaults;
  }, [visibleCardProps, availableCardProps]);

  // Whether any client-labeled property is enabled in Properties
  const showClientOnCards = useMemo(() => {
    return availableCardProps.some((p) => p.label.toLowerCase() === "client" && p.keys.some((k) => effectiveCardProps.has(k)));
  }, [availableCardProps, effectiveCardProps]);

  // Close props dropdown on outside click
  useEffect(() => {
    if (!propsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        propsButtonRef.current?.contains(e.target as Node) ||
        propsMenuRef.current?.contains(e.target as Node)
      ) return;
      setPropsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [propsOpen]);

  const toggleCardProp = (keys: string[]) => {
    const current = new Set(effectiveCardProps);
    const anyEnabled = keys.some((k) => current.has(k));
    for (const k of keys) {
      if (anyEnabled) current.delete(k);
      else current.add(k);
    }
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
        if (name && !seen.has(name) && !/^Opt[A-Z0-9]+$/.test(name)) {
          seen.add(name);
          const color = clientColorMap.get(name);
          opts.push({ id: name, name, badgeColor: color });
        }
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [columns, clientColorMap]);

  // Build filter options for all visible select/status-type properties
  const selectFilterProps = useMemo(() => {
    const result: { key: string; label: string; options: FilterOption[] }[] = [];
    for (const prop of availableCardProps) {
      if (prop.type !== "select" && prop.type !== "status") continue;
      if (!prop.keys.some((k) => effectiveCardProps.has(k))) continue;
      // Skip client — already handled by clientOptions
      if (prop.label.toLowerCase() === "client") continue;
      const optMap = new Map<string, FilterOption>();
      for (const col of columns) {
        for (const item of col.items) {
          for (const field of item.fields || []) {
            if (!prop.keys.includes(field.key)) continue;
            const display = field.displayValue?.trim();
            if (display && !/^Opt[A-Z0-9]+$/.test(display)) {
              if (!optMap.has(display)) {
                optMap.set(display, { id: display, name: display });
              }
            }
          }
        }
      }
      if (optMap.size > 0) {
        result.push({
          key: prop.keys[0],
          label: prop.label,
          options: [...optMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }
    return result;
  }, [availableCardProps, effectiveCardProps, columns]);

  // Active field filter keys (non-empty)
  const activeFieldFilterKeys = useMemo(
    () => Object.keys(fieldFilters).filter((k) => fieldFilters[k].size > 0),
    [fieldFilters]
  );

  // Apply filters and search to columns
  const applyFilters = useMemo(() => {
    const hasAssigneeFilter = filterAssignees.size > 0;
    const hasClientFilter = filterClients.size > 0;
    const hasFieldFilters = activeFieldFilterKeys.length > 0;
    const query = searchQuery.toLowerCase().trim();
    const hasSearch = query.length > 0;
    if (!hasAssigneeFilter && !hasClientFilter && !hasFieldFilters && !hasSearch) return columns;

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
        if (hasFieldFilters) {
          for (const key of activeFieldFilterKeys) {
            const selected = fieldFilters[key];
            const field = (item.fields || []).find((f) => f.key === key);
            const display = field?.displayValue?.trim() || "";
            if (!selected.has(display)) return false;
          }
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
  }, [columns, filterAssignees, filterClients, fieldFilters, activeFieldFilterKeys, assigneeOptions, searchQuery]);

  // Refs to track latest values for save calls inside setState callbacks
  const columnOrderRef = useRef(columnOrder);
  const hiddenColumnsRef = useRef(hiddenColumns);
  const minimizedColumnsRef = useRef(minimizedColumns);
  useEffect(() => { columnOrderRef.current = columnOrder; }, [columnOrder]);
  useEffect(() => { hiddenColumnsRef.current = hiddenColumns; }, [hiddenColumns]);
  useEffect(() => { minimizedColumnsRef.current = minimizedColumns; }, [minimizedColumns]);

  const hideColumn = (id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.add(id);
      hiddenColumnsRef.current = next;
      saveBoardPreferences(columnOrderRef.current, next, minimizedColumnsRef.current, fieldOrderRef.current, readOnly, itemOrderRef.current, activeViewIdRef.current);
      return next;
    });
  };

  const unhideColumn = (id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.delete(id);
      hiddenColumnsRef.current = next;
      saveBoardPreferences(columnOrderRef.current, next, minimizedColumnsRef.current, fieldOrderRef.current, readOnly, itemOrderRef.current, activeViewIdRef.current);
      return next;
    });
  };

  const minimizeColumn = (id: string) => {
    setMinimizedColumns((prev) => {
      const next = new Set(prev);
      next.add(id);
      minimizedColumnsRef.current = next;
      saveBoardPreferences(columnOrderRef.current, hiddenColumnsRef.current, next, fieldOrderRef.current, readOnly, itemOrderRef.current, activeViewIdRef.current);
      return next;
    });
  };

  const expandColumn = (id: string) => {
    setMinimizedColumns((prev) => {
      const next = new Set(prev);
      next.delete(id);
      minimizedColumnsRef.current = next;
      saveBoardPreferences(columnOrderRef.current, hiddenColumnsRef.current, next, fieldOrderRef.current, readOnly, itemOrderRef.current, activeViewIdRef.current);
      return next;
    });
  };

  const fieldFilterCount = activeFieldFilterKeys.reduce((sum, k) => sum + fieldFilters[k].size, 0);
  const hasActiveFilters = filterAssignees.size > 0 || filterClients.size > 0 || fieldFilterCount > 0;

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
    // Check field filters match
    const viewFieldFilters = view.filters || {};
    const viewFieldKeys = Object.keys(viewFieldFilters).filter((k) => viewFieldFilters[k].length > 0);
    if (activeFieldFilterKeys.length !== viewFieldKeys.length) return false;
    for (const key of activeFieldFilterKeys) {
      const viewSet = new Set(viewFieldFilters[key] || []);
      const current = fieldFilters[key];
      if (current.size !== viewSet.size) return false;
      for (const v of current) if (!viewSet.has(v)) return false;
    }
    // Check properties match
    if (view.properties) {
      const viewProps = new Set(view.properties);
      if (effectiveCardProps.size !== viewProps.size) return false;
      for (const key of effectiveCardProps) if (!viewProps.has(key)) return false;
    }
    return true;
  }, [activeViewId, savedViews, filterAssignees, filterClients, fieldFilters, activeFieldFilterKeys, effectiveCardProps]);

  const showSaveView = (hasActiveFilters || activeViewId) && !filtersMatchActiveView;

  const handleUpdateActiveView = useCallback(() => {
    if (!activeViewId) return;
    const serializedFilters: Record<string, string[]> = {};
    for (const key of activeFieldFilterKeys) {
      serializedFilters[key] = [...fieldFilters[key]];
    }
    const next = savedViews.map((v) =>
      v.id === activeViewId
        ? { ...v, assignees: [...filterAssignees], clients: [...filterClients], filters: serializedFilters, properties: [...effectiveCardProps] }
        : v
    );
    setSavedViews(next);
    saveViews(next);
  }, [activeViewId, filterAssignees, filterClients, fieldFilters, activeFieldFilterKeys, effectiveCardProps, savedViews]);

  const handleSaveView = useCallback(() => {
    const name = viewName.trim();
    if (!name) return;
    const serializedFilters: Record<string, string[]> = {};
    for (const key of activeFieldFilterKeys) {
      serializedFilters[key] = [...fieldFilters[key]];
    }
    const view: SavedView = {
      id: Date.now().toString(),
      name,
      assignees: [...filterAssignees],
      clients: [...filterClients],
      filters: serializedFilters,
      properties: [...effectiveCardProps],
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    saveViews(next);
    updateActiveViewId(view.id);
    setSavingView(false);
    setViewName("");
  }, [viewName, filterAssignees, filterClients, fieldFilters, activeFieldFilterKeys, effectiveCardProps, savedViews]);

  const handleLoadView = (view: SavedView) => {
    if (activeViewId === view.id) {
      setFilterAssignees(new Set());
      setFilterClients(new Set());
      setFieldFilters({});
      updateActiveViewId(null);
      // Reset properties to defaults
      setVisibleCardProps(null);
      localStorage.removeItem(CARD_PROPS_KEY);
    } else {
      setFilterAssignees(new Set(view.assignees));
      setFilterClients(new Set(view.clients));
      const restored: Record<string, Set<string>> = {};
      if (view.filters) {
        for (const [k, v] of Object.entries(view.filters)) {
          if (v.length > 0) restored[k] = new Set(v);
        }
      }
      setFieldFilters(restored);
      if (view.properties) {
        setVisibleCardProps(view.properties);
        saveCardProperties(view.properties);
      }
      updateActiveViewId(view.id);
    }
  };

  const handleDeleteView = (id: string) => {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    saveViews(next);
    if (activeViewId === id) updateActiveViewId(null);
    setViewMenuOpen(null);
  };

  const handleRenameView = (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    const next = savedViews.map((v) => v.id === id ? { ...v, name } : v);
    setSavedViews(next);
    saveViews(next);
    setRenamingViewId(null);
    setRenameValue("");
  };

  const handleViewDrop = (targetId: string) => {
    if (!draggingViewId || draggingViewId === targetId) return;
    const fromIndex = savedViews.findIndex((v) => v.id === draggingViewId);
    const toIndex = savedViews.findIndex((v) => v.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...savedViews];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSavedViews(next);
    saveViews(next);
    setDraggingViewId(null);
    setViewDropTarget(null);
  };

  const [shareDialogViewId, setShareDialogViewId] = useState<string | null>(null);

  // Close view context menu on outside click
  useEffect(() => {
    if (!viewMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        viewMenuRef.current?.contains(e.target as Node) ||
        viewMenuTriggerRef.current?.contains(e.target as Node)
      ) return;
      setViewMenuOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [viewMenuOpen]);

  // Focus save input when it appears
  useEffect(() => {
    if (savingView) saveInputRef.current?.focus();
  }, [savingView]);

  const visibleColumns = applyFilters.filter((c) => !hiddenColumns.has(c.id) && !(isSharedView && c.name.toLowerCase() === "no status" && c.items.length === 0));
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

    // Same-column reorder
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

        // Persist item order
        const newItemOrder = { ...itemOrderRef.current, [sourceColumnId]: col.items.map((i) => i.id) };
        setItemOrder(newItemOrder);
        itemOrderRef.current = newItemOrder;
        saveBoardPreferences(columnOrderRef.current, hiddenColumnsRef.current, minimizedColumnsRef.current, fieldOrderRef.current, readOnly, newItemOrder, activeViewIdRef.current);

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
        `/api/lists/${draggedItem.sourceListId}/items/${itemId}${shareToken ? `?shareToken=${shareToken}` : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: draggedItem.sourceWorkspaceId,
            cells,
            statusLabel: targetColumnId,
            ...(shareToken ? { shareToken } : {}),
          }),
        }
      );

      if (!res.ok) throw new Error("Update failed");
      setError("");
    } catch (err) {
      console.error("Move item error:", err);
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
        `/api/lists/${targetItem.sourceListId}/items/${itemId}?workspaceId=${targetItem.sourceWorkspaceId}${shareToken ? `&shareToken=${shareToken}` : ""}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
    } catch (err) {
      console.error("Delete item error:", err);
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
    setSelectedItem((prev) => {
      if (!prev || prev.id !== itemId) return prev;
      return { ...prev, title: newTitle };
    });

    try {
      // Look up the real column ID for the name field from the item's raw data
      const nameField = targetItem.fields?.find((f) => f.key === "name");
      // rawItem.columnValues is the raw Slack fields array at runtime
      const rawFields = targetItem.rawItem?.columnValues as unknown as Array<Record<string, unknown>> | undefined;
      const rawNameField = rawFields?.find((f) => f.key === "name");
      let nameColumnId =
        nameField?.columnId || (rawNameField?.column_id as string) || "";

      // If this item doesn't have a name column (e.g. created via API), find it from a sibling item
      if (!nameColumnId) {
        for (const col of columns) {
          for (const sibling of col.items) {
            if (sibling.sourceListId !== targetItem.sourceListId) continue;
            const siblingRaw = sibling.rawItem?.columnValues as unknown as Array<Record<string, unknown>> | undefined;
            const siblingName = siblingRaw?.find((f) => f.key === "name");
            if (siblingName?.column_id) {
              nameColumnId = siblingName.column_id as string;
              break;
            }
          }
          if (nameColumnId) break;
        }
      }

      const cells = [
        {
          column_id: nameColumnId,
          rich_text: [
            {
              type: "rich_text",
              elements: [
                {
                  type: "rich_text_section",
                  elements: [{ type: "text", text: newTitle }],
                },
              ],
            },
          ],
        },
      ];

      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}${shareToken ? `?shareToken=${shareToken}` : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: targetItem.sourceWorkspaceId,
            cells,
            ...(shareToken ? { shareToken } : {}),
          }),
        }
      );

      if (!res.ok) throw new Error("Rename failed");
      toast.success("Saved");
      setTimeout(onRefresh, 1000);
    } catch (err) {
      console.error("Rename item error:", err);
      toast.error("Failed to save");
      onRefresh();
    }
  };

  const handleUpdateField = async (
    itemId: string,
    columnId: string,
    value: unknown,
    fieldType?: string
  ) => {
    let targetItem: BoardItem | undefined;
    for (const col of columns) {
      targetItem = col.items.find((i) => i.id === itemId);
      if (targetItem) break;
    }
    if (!targetItem) return;

    // Resolve display value for optimistic update
    let displayValue = String(value ?? "");
    if ((fieldType === "select" || fieldType === "status") && Array.isArray(value)) {
      // Look up labels from schema
      const sf = (data.schema || []).find((s) => s.id === columnId || s.key === columnId);
      if (sf?.options) {
        const labels = value.map((id: string) => {
          const opt = sf.options?.find((o) => o.value === id);
          return opt?.label || id;
        });
        displayValue = labels.join(", ");
      } else {
        displayValue = value.join(", ");
      }
    }

    const updateFields = (fields: typeof targetItem.fields) => {
      if (!fields) return fields;
      const found = fields.some((f) => f.columnId === columnId);
      if (found) {
        return fields.map((f) =>
          f.columnId === columnId ? { ...f, value, displayValue } : f
        );
      }
      // Field doesn't exist on item yet (empty schema field) — add it
      const sf = (data.schema || []).find((s) => s.id === columnId || s.key === columnId);
      return [...fields, {
        columnId,
        key: sf?.key || columnId,
        type: fieldType || sf?.type || "unknown",
        label: sf?.label || columnId,
        value,
        displayValue,
      }];
    };

    // Buffer the optimistic update so it survives data refreshes
    const pendingKey = `${itemId}:${columnId}`;
    pendingUpdatesRef.current.set(pendingKey, {
      itemId, columnId, value, displayValue, fieldType, timestamp: Date.now(),
    });

    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        items: col.items.map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, fields: updateFields(item.fields) };
        }),
      }))
    );

    // Also update selectedItem so the detail modal reflects the change
    setSelectedItem((prev) => {
      if (!prev || prev.id !== itemId) return prev;
      return { ...prev, fields: updateFields(prev.fields) };
    });

    try {
      // Resolve real Slack column ID from raw item data
      const rawFields = targetItem.rawItem?.columnValues as unknown as Array<Record<string, unknown>> | undefined;
      const rawField = rawFields?.find(
        (f) => f.column_id === columnId || f.key === columnId
      );
      const realColumnId = (rawField?.column_id as string) || columnId;

      const cell: Record<string, unknown> = { column_id: realColumnId };
      // Determine the field type to use the correct Slack cell format
      const fieldDef = targetItem.fields?.find((f) => f.columnId === columnId);
      const resolvedType = fieldType || fieldDef?.type || (rawField?.type as string);

      if ((resolvedType === "people" || resolvedType === "user") && Array.isArray(value)) {
        cell.user = value;
      } else if ((resolvedType === "select" || resolvedType === "status") && Array.isArray(value)) {
        cell.select = value;
      } else if (resolvedType === "date" && typeof value === "string") {
        cell.date = [value];
      } else if (resolvedType === "number") {
        cell.number = [typeof value === "number" ? value : Number(value)];
      } else if (resolvedType === "link" && typeof value === "string") {
        cell.link = [
          {
            original_url: value,
            display_as_url: true,
            display_name: value,
          },
        ];
      } else if (resolvedType === "checkbox") {
        cell.checkbox = Boolean(value);
      } else if (typeof value === "string") {
        // Default for text, rich_text, message, and any other text-like types
        cell.rich_text = [
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_section",
                elements: [{ type: "text", text: value }],
              },
            ],
          },
        ];
      } else if (Array.isArray(value)) {
        cell.select = value;
      }

      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}${shareToken ? `?shareToken=${shareToken}` : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: targetItem.sourceWorkspaceId,
            cells: [cell],
            ...(shareToken ? { shareToken } : {}),
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Update field failed:", body);
        if (body.code === "USER_TOKEN_REQUIRED") {
          toast.error("Link columns require re-authorization. Please disconnect and reconnect this workspace.");
          onRefresh();
          return;
        }
        throw new Error(body.error || "Update field failed");
      }
      toast.success("Saved");
      setTimeout(onRefresh, 1000);
    } catch (err) {
      console.error("Update field error:", err);
      toast.error("Failed to save");
      onRefresh();
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
    // Fall back to schema if item doesn't have a people field yet
    const peopleSchema = (data.schema || []).find(
      (s) => (s.type === "people" || s.type === "user") && (!s.sourceListId || s.sourceListId === targetItem!.sourceListId)
    );
    const peopleColumnId = peopleField?.columnId || peopleSchema?.id;
    if (!peopleColumnId) return;

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
    const applyAssigneeUpdate = (item: BoardItem): BoardItem => ({
      ...item,
      assignees: updatedAssignees,
      fields: item.fields?.map((f) =>
        f.columnId === peopleColumnId
          ? { ...f, value: resolvedIds, displayValue: updatedAssignees.map((a) => a.displayName).join(", ") }
          : f
      ),
    });

    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        items: col.items.map((item) =>
          item.id === itemId ? applyAssigneeUpdate(item) : item
        ),
      }))
    );

    setSelectedItem((prev) => {
      if (!prev || prev.id !== itemId) return prev;
      return applyAssigneeUpdate(prev);
    });

    try {
      const res = await fetch(
        `/api/lists/${targetItem.sourceListId}/items/${itemId}${shareToken ? `?shareToken=${shareToken}` : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: targetItem.sourceWorkspaceId,
            cells: [{ column_id: peopleColumnId, user: resolvedIds }],
            ...(shareToken ? { shareToken } : {}),
          }),
        }
      );
      if (!res.ok) throw new Error("Update assignees failed");
      toast.success("Saved");
      setTimeout(onRefresh, 1000);
    } catch (err) {
      console.error("Update assignees error:", err);
      toast.error("Failed to save");
      onRefresh();
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
        `/api/lists/${targetList.listId}?workspaceId=${targetList.workspaceId}${shareToken ? `&shareToken=${shareToken}` : ""}`
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
          if (clientCol?.options) {
            const match = clientCol.options.find(
              (o: { label: string }) => o.label === clientId
            );
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

    try {
      const res = await fetch(`/api/lists/${targetList.listId}/items${shareToken ? `?shareToken=${shareToken}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: targetList.workspaceId,
          initialFields,
          ...(shareToken ? { shareToken } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Create failed:", errData);
        throw new Error("Create failed");
      }
      onRefresh();
    } catch (err) {
      console.error("Create item error:", err);
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
      columnOrderRef.current = newOrder;
      saveBoardPreferences(newOrder, hiddenColumnsRef.current, minimizedColumnsRef.current, fieldOrderRef.current, readOnly, itemOrderRef.current, activeViewIdRef.current);
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
      {shareDialogViewId && (
        <ShareDialog
          viewId={shareDialogViewId}
          onClose={() => setShareDialogViewId(null)}
        />
      )}

      {/* Toolbar: portaled to header in desktop app, inline otherwise */}
      {(() => {
        const toolbarContent = (
        <FadeScroll className="flex items-center gap-2 py-0.5 -my-0.5 px-0.5 -mx-0.5">
          {/* Search (mobile) */}
          {externalSearch === undefined && (
          <div
            className="relative shrink-0 sm:hidden cursor-pointer"
            onClick={() => {
              if (!mobileSearchOpen) {
                setMobileSearchOpen(true);
                requestAnimationFrame(() => mobileSearchRef.current?.focus());
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors duration-200 ${mobileSearchOpen ? "text-gray-400" : "text-gray-600"}`}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={mobileSearchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={mobileSearchOpen ? "Search..." : ""}
              className={`h-7 rounded-full text-xs text-gray-700 transition-all duration-200 ease-out outline-none ${
                mobileSearchOpen
                  ? "w-44 border border-gray-200 bg-white pl-7 pr-8 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  : "w-7 border border-transparent bg-gray-100 pl-7 pr-0 cursor-pointer"
              }`}
              style={{ caretColor: mobileSearchOpen ? undefined : "transparent" }}
              onBlur={() => { if (!searchQuery) setMobileSearchOpen(false); }}
              readOnly={!mobileSearchOpen}
            />
            {mobileSearchOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); setSearchQuery(""); setMobileSearchOpen(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          )}
          {/* Desktop search */}
          {externalSearch === undefined && (
          <div className="relative shrink-0 hidden sm:block">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
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
          )}

          {!readOnly && !isSharedView && <>
          {/* Properties - icon only on mobile */}
          <div className="shrink-0">
            <button
              ref={propsButtonRef}
              onClick={() => setPropsOpen((v) => !v)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors h-7 w-7 sm:h-auto sm:w-auto sm:px-3 sm:py-1 ${
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
              <span className="hidden sm:inline">Properties</span>
            </button>
            {propsOpen && createPortal(
              <div
                ref={propsMenuRef}
                className="fixed z-50 w-56 rounded-lg ring-1 ring-border bg-white py-1 shadow-lg"
                style={{
                  top: (propsButtonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                  left: propsButtonRef.current?.getBoundingClientRect().left ?? 0,
                }}
              >
                {availableCardProps.map((prop) => (
                  <label
                    key={prop.keys[0]}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={prop.keys.some((k) => effectiveCardProps.has(k))}
                      onChange={() => toggleCardProp(prop.keys)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    <span className="truncate">{prop.label}</span>
                    <span className="ml-auto text-[10px] text-gray-400">{prop.type}</span>
                  </label>
                ))}
                {availableCardProps.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No properties available</div>
                )}
              </div>,
              document.body
            )}
          </div>

          {/* Filters - icon only on mobile */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors h-7 w-7 sm:h-auto sm:w-auto sm:pl-3 sm:py-1 ${
              hasActiveFilters && !filtersOpen ? "sm:pr-1.5" : "sm:pr-3"
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
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && !filtersOpen && (
              <span className="hidden sm:flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white">
                {filterAssignees.size + filterClients.size + fieldFilterCount}
              </span>
            )}
          </button>

          {/* Divider + Saved views */}
          {savedViews.length > 0 && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className={`shrink-0 ${draggingViewId === view.id ? "opacity-50" : ""} ${viewDropTarget === view.id && draggingViewId !== view.id ? "ring-2 ring-blue-300 rounded-full" : ""}`}
                  draggable={renamingViewId !== view.id}
                  onDragStart={(e) => {
                    setDraggingViewId(view.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", view.id);
                  }}
                  onDragEnd={() => {
                    setDraggingViewId(null);
                    setViewDropTarget(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setViewDropTarget(view.id);
                  }}
                  onDragLeave={() => setViewDropTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleViewDrop(view.id);
                  }}
                >
                  {renamingViewId === view.id ? (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(e) => { e.preventDefault(); handleRenameView(view.id); }}
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-6 w-28 rounded-full border border-blue-300 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        onKeyDown={(e) => { if (e.key === "Escape") { setRenamingViewId(null); setRenameValue(""); } }}
                        onBlur={() => { if (renameValue.trim()) handleRenameView(view.id); else { setRenamingViewId(null); setRenameValue(""); } }}
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => handleLoadView(view)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        activeViewId === view.id
                          ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {view.name}
                      {activeViewId === view.id && (
                        <span
                          ref={viewMenuTriggerRef}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setViewMenuPos({ top: rect.bottom + 4, left: rect.left });
                            setViewMenuOpen(viewMenuOpen === view.id ? null : view.id);
                          }}
                          className="flex items-center justify-center -mr-2 h-4 w-4 rounded-full hover:bg-blue-200 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="3" r="1.5" />
                            <circle cx="8" cy="8" r="1.5" />
                            <circle cx="8" cy="13" r="1.5" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )}
                  {viewMenuOpen === view.id && createPortal(
                    <div
                      ref={viewMenuRef}
                      className="fixed z-50 min-w-[120px] rounded-lg ring-1 ring-border bg-white p-1 shadow-lg"
                      style={{ top: viewMenuPos.top, left: viewMenuPos.left }}
                    >
                      <button
                        onClick={() => {
                          setRenameValue(view.name);
                          setRenamingViewId(view.id);
                          setViewMenuOpen(null);
                          setTimeout(() => renameInputRef.current?.focus(), 0);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setViewMenuOpen(null);
                          setShareDialogViewId(view.id);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                        Share
                      </button>
                      <button
                        onClick={() => handleDeleteView(view.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              ))}
            </>
          )}

          {/* Save / update view */}
          {showSaveView && !savingView && activeViewId && (
            <div className="shrink-0 inline-flex items-center gap-2 ml-2">
              <button
                onClick={handleUpdateActiveView}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  const view = savedViews.find((v) => v.id === activeViewId);
                  if (view) handleLoadView(view);
                }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {showSaveView && !savingView && !activeViewId && (
            <button
              onClick={() => setSavingView(true)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
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
          </>}
        </FadeScroll>
        );

        const showToolbar = externalSearch === undefined || !readOnly;

        return (
          <>
            {showToolbar && (isDesktopApp && desktopPortal
              ? createPortal(toolbarContent, desktopPortal)
              : <div className="px-4 pt-3">{toolbarContent}</div>
            )}
            <div className={isDesktopApp && desktopPortal ? "px-4 pt-2" : "px-4"}>
        {/* Collapsible filter row: Assignee, Client, Show Hidden, Properties */}
        {filtersOpen && !readOnly && !isSharedView && (
          <FadeScroll className="flex items-center gap-2">
            {assigneeOptions.length > 0 && effectiveCardProps.has("assignees") && (
              <FilterDropdown
                label="Assignee"
                options={assigneeOptions}
                selected={filterAssignees}
                onChange={(v) => { setFilterAssignees(v); updateActiveViewId(null); }}
              />
            )}
            {clientOptions.length > 0 && availableCardProps.some((p) => p.label.toLowerCase() === "client" && p.keys.some((k) => effectiveCardProps.has(k))) && (
              <FilterDropdown
                label="Client"
                options={clientOptions}
                selected={filterClients}
                onChange={(v) => { setFilterClients(v); updateActiveViewId(null); }}
              />
            )}
            {selectFilterProps.map((prop) => (
              <FilterDropdown
                key={prop.key}
                label={prop.label}
                options={prop.options}
                selected={fieldFilters[prop.key] || new Set()}
                onChange={(v) => {
                  setFieldFilters((prev) => ({ ...prev, [prop.key]: v }));
                  updateActiveViewId(null);
                }}
              />
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowHidden((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showHidden ? (
                    <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                  ) : (
                    <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                  )}
                </svg>
                {showHidden ? "Hide" : "Show"} {hiddenCount} hidden
              </button>
            )}
          </FadeScroll>
        )}
            </div>
          </>
        );
      })()}

      <div className="flex flex-1 gap-4 overflow-x-auto p-4 snap-x snap-mandatory sm:snap-none">
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
              onHide={readOnly ? undefined : () => hideColumn(column.id)}
              onMinimize={() => minimizeColumn(column.id)}
              onExpand={() => expandColumn(column.id)}
              minimized={isMinimized}
              clientColorMap={clientColorMap}
              assigneeOptions={assigneeOptions}
              clientOptions={clientOptions}
              defaultAssignees={filterAssignees.size > 0 ? filterAssignees : undefined}
              defaultClient={filterClients.size === 1 ? [...filterClients][0] : null}
              visibleProperties={effectiveCardProps}
              showClient={showClientOnCards}
              onColumnDragStart={() => handleColumnDragStart(column.id)}
              onColumnDragEnd={handleColumnDragEnd}
              onColumnDrop={() => handleColumnDrop(column.id)}
              isColumnDragging={draggingColumnId === column.id}
              readOnly={readOnly}
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
              showClient={showClientOnCards}
            />
          );
        })}
      </div>

      {selectedItem && (
        <CardDetailModal
          item={selectedItem}
          schema={(data.schema || []).filter((s) => !s.sourceListId || s.sourceListId === selectedItem.sourceListId)}
          onClose={() => setSelectedItem(null)}
          onRename={(newTitle) => handleRenameItem(selectedItem.id, newTitle)}
          onUpdateField={(columnId, value, fieldType) =>
            handleUpdateField(selectedItem.id, columnId, value, fieldType)
          }
          onDelete={readOnly ? undefined : () => {
            const col = columns.find((c) =>
              c.items.some((i) => i.id === selectedItem.id)
            );
            if (col) handleDeleteItem(selectedItem.id, col.id);
          }}
          assigneeOptions={assigneeOptions}
          onUpdateAssignees={(userIds) =>
            handleUpdateAssignees(selectedItem.id, userIds)
          }
          fieldOrder={fieldOrder}
          onFieldOrderChange={readOnly ? undefined : (order) => {
            setFieldOrder(order);
            fieldOrderRef.current = order;
            saveBoardPreferences(columnOrderRef.current, hiddenColumnsRef.current, minimizedColumnsRef.current, order, undefined, itemOrderRef.current, activeViewIdRef.current);
          }}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
