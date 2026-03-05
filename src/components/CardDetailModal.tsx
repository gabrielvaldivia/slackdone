"use client";

import { useEffect, useRef, useState } from "react";
import { BoardItem, SchemaField } from "@/lib/types";
import FieldEditor from "./FieldEditor";
import { FilterOption } from "./FilterDropdown";
import FloatingDropdown from "./FloatingDropdown";

interface CardDetailModalProps {
  item: BoardItem;
  schema: SchemaField[];
  onClose: () => void;
  onRename: (newTitle: string) => void;
  onUpdateField: (columnId: string, value: unknown) => void;
  onDelete?: () => void;
  assigneeOptions?: FilterOption[];
  onUpdateAssignees?: (userIds: string[]) => void;
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
}: CardDetailModalProps) {
  const [title, setTitle] = useState(item.title);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync title when item changes externally
  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const schemaMap = new Map(schema.map((s) => [s.id, s]));
  const schemaByKey = new Map(schema.map((s) => [s.key, s]));
  const fields = item.fields || [];
  const assignees = item.assignees || [];
  const assigneeIds = new Set(assignees.map((a) => a.id));

  // Find the people field column ID for assignee updates
  const peopleField = fields.find((f) => f.type === "people" || f.type === "user");

  // Check if an option is already assigned (handles cross-workspace merged IDs)
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
    // Check if this person is already assigned (across merged workspace IDs)
    const opt = assigneeOptions.find((o) => o.id === id);
    const allIdsForPerson = opt?.ids || [id];
    const existingId = current.find((uid) => allIdsForPerson.includes(uid));

    let next: string[];
    if (existingId) {
      // Remove — filter out the workspace-specific ID that's already there
      next = current.filter((uid) => uid !== existingId);
    } else {
      // Add — pass the option ID; Board will resolve to correct workspace
      next = [...current, id];
    }
    if (onUpdateAssignees) {
      onUpdateAssignees(next);
    } else if (peopleField) {
      onUpdateField(peopleField.columnId, next);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-gray-200 p-5">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleTitleBlur();
              }
            }}
            rows={1}
            className="flex-1 resize-none bg-transparent text-lg font-semibold outline-none"
          />
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Assignees */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Assignees
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {assignees.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleAssignee(user.id)}
                  className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-1 pr-3 hover:bg-red-50 group transition-colors"
                  title={`Remove ${user.displayName}`}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-[10px] font-medium text-gray-600 overflow-hidden">
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
                  <span className="text-sm group-hover:text-red-600">{user.displayName}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-red-500">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ))}
              {assigneeOptions.length > 0 && (
                <FloatingDropdown
                  open={assigneeDropdownOpen}
                  onOpenChange={setAssigneeDropdownOpen}
                  trigger={
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                      title="Add assignee"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  }
                >
                  {assigneeOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned(opt.id)}
                        onChange={() => toggleAssignee(opt.id)}
                        className="h-3 w-3 rounded border-gray-300 text-blue-600"
                      />
                      {opt.avatar ? (
                        <img src={opt.avatar} alt="" className="h-4 w-4 rounded-full" />
                      ) : (
                        <span className="h-4 w-4 rounded-full bg-gray-300 inline-flex items-center justify-center text-[8px] text-white">
                          {opt.name[0]}
                        </span>
                      )}
                      <span className="truncate">{opt.name}</span>
                    </label>
                  ))}
                </FloatingDropdown>
              )}
              {assignees.length === 0 && assigneeOptions.length === 0 && (
                <span className="text-sm text-gray-400">No one assigned</span>
              )}
            </div>
          </div>

          {/* Fields */}
          {fields.map((field) => {
            // Skip people/user fields shown above as assignees
            if (field.type === "people" || field.type === "user") return null;
            // Skip internal completion field (handled by moving to Done column)
            if (field.key === "todo_completed" || field.label === "TODO_COMPLETED") return null;

            const sf = schemaMap.get(field.columnId) || schemaByKey.get(field.key);

            return (
              <div key={field.columnId || field.key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
                  {field.label}
                </label>
                <FieldEditor
                  field={field}
                  schema={sf}
                  onUpdate={(value) => onUpdateField(field.columnId, value)}
                />
              </div>
            );
          })}

          {fields.length === 0 && assignees.length === 0 && (
            <p className="text-sm text-gray-400">No additional fields</p>
          )}
        </div>

        {/* Footer */}
        {onDelete && (
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => {
                if (window.confirm("Delete this item?")) {
                  onDelete();
                  onClose();
                }
              }}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Delete item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
