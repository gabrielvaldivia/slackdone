"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoardItem, SchemaField } from "@/lib/types";
import FieldEditor from "./FieldEditor";
import { FilterOption } from "./FilterDropdown";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface CardDetailModalProps {
  item: BoardItem;
  schema: SchemaField[];
  onClose: () => void;
  onRename: (newTitle: string) => void;
  onUpdateField: (columnId: string, value: unknown, fieldType?: string) => void;
  onDelete?: () => void;
  assigneeOptions?: FilterOption[];
  onUpdateAssignees?: (userIds: string[]) => void;
  fieldOrder?: string[];
  onFieldOrderChange?: (order: string[]) => void;
  readOnly?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function CardDetailModal({
  item,
  schema,
  onClose,
  onRename,
  onUpdateField,
  onDelete,
  assigneeOptions = [],
  onUpdateAssignees,
  fieldOrder = [],
  onFieldOrderChange,
  readOnly,
}: CardDetailModalProps) {
  const [title, setTitle] = useState(item.title);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const dragFieldRef = useRef<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);

  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);

  const schemaMap = new Map(schema.map((s) => [s.id, s]));
  const schemaByKey = new Map(schema.map((s) => [s.key, s]));
  const fields = item.fields || [];
  const assignees = item.assignees || [];
  const assigneeIds = new Set(assignees.map((a) => a.id));

  const peopleField = fields.find((f) => f.type === "people" || f.type === "user");

  const isAssigned = (optId: string) => {
    if (assigneeIds.has(optId)) return true;
    const opt = assigneeOptions.find((o) => o.id === optId);
    if (opt?.ids) return opt.ids.some((uid) => assigneeIds.has(uid));
    return false;
  };

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      onRename(trimmed);
    }
  };

  const toggleAssignee = (id: string) => {
    const current = assignees.map((a) => a.id);
    const opt = assigneeOptions.find((o) => o.id === id);
    const allIdsForPerson = opt?.ids || [id];
    const existingId = current.find((uid) => allIdsForPerson.includes(uid));

    let next: string[];
    if (existingId) {
      next = current.filter((uid) => uid !== existingId);
    } else {
      next = [...current, id];
    }
    if (onUpdateAssignees) {
      onUpdateAssignees(next);
    } else if (peopleField) {
      onUpdateField(peopleField.columnId, next);
    }
  };

  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  const setTitleRef = useCallback((el: HTMLTextAreaElement | null) => {
    titleRef.current = el;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, []);

  const autoResize = () => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  useEffect(() => {
    autoResize();
  }, [title]);

  const titleArea = (
    <div className="flex items-start gap-2">
      <textarea
        ref={setTitleRef}
        value={title}
        onChange={(e) => { if (!readOnly) setTitle(e.target.value); }}
        onBlur={readOnly ? undefined : handleTitleBlur}
        onKeyDown={readOnly ? undefined : (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleTitleBlur();
          }
        }}
        rows={1}
        readOnly={readOnly}
        className={`flex-1 resize-none bg-transparent text-lg font-semibold outline-none overflow-hidden${readOnly ? " cursor-default" : ""}`}
      />
      {onDelete && !readOnly && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="end">
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                setMenuOpen(false);
                if (window.confirm("Delete this item?")) {
                  onDelete();
                  onClose();
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete item
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      {/* Assignees */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Assignees
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          {assignees.map((user) => (
            readOnly ? (
            <div
              key={user.id}
              className="flex items-center gap-2 rounded-full bg-secondary py-1 pl-1 pr-3"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground overflow-hidden">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(user.displayName)
                )}
              </div>
              <span className="text-sm">{user.displayName}</span>
            </div>
            ) : (
            <button
              key={user.id}
              onClick={() => toggleAssignee(user.id)}
              className="flex items-center gap-2 rounded-full bg-secondary py-1 pl-1 pr-3 hover:bg-destructive/10 group transition-colors"
              title={`Remove ${user.displayName}`}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground overflow-hidden">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(user.displayName)
                )}
              </div>
              <span className="text-sm group-hover:text-destructive">{user.displayName}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-destructive">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            )
          ))}
          {!readOnly && assigneeOptions.length > 0 && (
            <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full border-dashed"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1" align="start">
                {assigneeOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={isAssigned(opt.id)}
                      onCheckedChange={() => toggleAssignee(opt.id)}
                      className="h-3.5 w-3.5"
                    />
                    {opt.avatar ? (
                      <img src={opt.avatar} alt="" className="h-5 w-5 rounded-full" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                        {opt.name[0]}
                      </span>
                    )}
                    <span className="truncate">{opt.name}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {assignees.length === 0 && assigneeOptions.length === 0 && (
            <span className="text-sm text-muted-foreground">No one assigned</span>
          )}
        </div>
      </div>

      {/* Fields — show all schema fields, even empty ones, drag to reorder */}
      {(() => {
        // Build sets of all identifiers for fields already on the item
        const existingColumnIds = new Set(fields.map((f) => f.columnId));
        const existingKeys = new Set(fields.map((f) => f.key));
        for (const f of fields) {
          const sf = schemaMap.get(f.columnId) || schemaByKey.get(f.key);
          if (sf) {
            existingColumnIds.add(sf.id);
            existingKeys.add(sf.key);
          }
        }

        // Build unified list of field entries: { id, label, field, schema }
        type FieldEntry = { id: string; label: string; field: { columnId: string; key: string; type: string; label: string; value: unknown; displayValue: string }; sf?: SchemaField };

        const entries: FieldEntry[] = [];
        const seenIds = new Set<string>();

        // Existing fields
        for (const field of fields) {
          if (field.type === "people" || field.type === "user") continue;
          if (field.key === "todo_completed" || field.label === "TODO_COMPLETED") continue;
          const sf = schemaMap.get(field.columnId) || schemaByKey.get(field.key);
          const id = sf?.id || field.columnId || field.key;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          entries.push({ id, label: field.label, field, sf });
        }

        // Empty fields from schema
        for (const sf of schema) {
          if (sf.type === "people" || sf.type === "user") continue;
          if (sf.key === "name" || sf.key === "todo_completed") continue;
          if (seenIds.has(sf.id)) continue;
          if (existingColumnIds.has(sf.id) || existingKeys.has(sf.key)) continue;
          seenIds.add(sf.id);
          entries.push({
            id: sf.id,
            label: sf.label,
            field: { columnId: sf.id, key: sf.key, type: sf.type, label: sf.label, value: null, displayValue: "" },
            sf,
          });
        }

        // Sort by fieldOrder
        if (fieldOrder.length > 0) {
          const orderMap = new Map(fieldOrder.map((id, i) => [id, i]));
          entries.sort((a, b) => {
            const ai = orderMap.get(a.id) ?? 999;
            const bi = orderMap.get(b.id) ?? 999;
            return ai - bi;
          });
        }

        const handleDragStart = (id: string) => {
          dragFieldRef.current = id;
        };

        const handleDragOver = (e: React.DragEvent, id: string) => {
          e.preventDefault();
          setDragOverFieldId(id);
        };

        const handleDrop = (targetId: string) => {
          const sourceId = dragFieldRef.current;
          dragFieldRef.current = null;
          setDragOverFieldId(null);
          if (!sourceId || sourceId === targetId) return;

          const ids = entries.map((e) => e.id);
          const fromIdx = ids.indexOf(sourceId);
          const toIdx = ids.indexOf(targetId);
          if (fromIdx < 0 || toIdx < 0) return;

          const next = [...ids];
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, sourceId);
          onFieldOrderChange?.(next);
        };

        const handleDragEnd = () => {
          dragFieldRef.current = null;
          setDragOverFieldId(null);
        };

        return entries.map((entry) => (
          <div
            key={entry.id}
            draggable={!readOnly}
            onDragStart={readOnly ? undefined : () => handleDragStart(entry.id)}
            onDragOver={readOnly ? undefined : (e) => handleDragOver(e, entry.id)}
            onDrop={readOnly ? undefined : () => handleDrop(entry.id)}
            onDragEnd={readOnly ? undefined : handleDragEnd}
            className={`space-y-2 ${dragOverFieldId === entry.id ? "border-t-2 border-foreground" : ""}`}
          >
            <Label className={`relative text-xs uppercase tracking-wider text-muted-foreground${readOnly ? "" : " cursor-grab group/field"}`}>
              {!readOnly && <span className="absolute -left-3.5 opacity-0 group-hover/field:opacity-100 transition-opacity text-muted-foreground/50">⠿</span>}
              {entry.label}
            </Label>
            {readOnly ? (
              <p className="text-sm text-foreground">{entry.field.displayValue || <span className="text-muted-foreground">—</span>}</p>
            ) : (
              <FieldEditor
                field={entry.field}
                schema={entry.sf}
                onUpdate={(value) => onUpdateField(entry.field.columnId, value, entry.field.type)}
                disablePortal
              />
            )}
          </div>
        ));
      })()}
    </div>
  );

  if (isDesktop) {
    return (
      <Sheet open={sheetOpen} onOpenChange={(open) => {
        if (!open) {
          setSheetOpen(false);
          setTimeout(onClose, 300);
        }
      }}>
        <SheetContent showCloseButton={false} className="flex flex-col overflow-hidden sm:max-w-lg p-0">
          <SheetHeader className="px-6 pt-6 pb-0 space-y-0">
            <SheetTitle className="sr-only">Edit task</SheetTitle>
            {titleArea}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={sheetOpen} onOpenChange={(open) => {
      if (!open) {
        setSheetOpen(false);
        setTimeout(onClose, 300);
      }
    }}>
      <DrawerContent className="flex flex-col max-h-[96vh]">
        <DrawerHeader className="px-6 pt-4 pb-0 space-y-0 text-left">
          <DrawerTitle className="sr-only">Edit task</DrawerTitle>
          {titleArea}
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
}
