"use client";

import { useEffect, useState } from "react";
import { BoardItem, SchemaField } from "@/lib/types";
import FieldEditor from "./FieldEditor";

interface CardDetailModalProps {
  item: BoardItem;
  schema: SchemaField[];
  onClose: () => void;
  onRename: (newTitle: string) => void;
  onUpdateField: (columnId: string, value: unknown) => void;
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
}: CardDetailModalProps) {
  const [title, setTitle] = useState(item.title);

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

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      onRename(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleBlur();
            }}
            className="flex-1 bg-transparent text-lg font-semibold outline-none"
          />
          <button
            onClick={onClose}
            className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          {/* Assignees section */}
          {assignees.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Assignees
              </label>
              <div className="flex flex-wrap gap-2">
                {assignees.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-1 pr-3"
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
                    <span className="text-sm">{user.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fields */}
          {fields.map((field) => {
            // Skip status field (already visible in column placement)
            if (field.type === "status" || field.type === "select") {
              // Still show it if it's not the primary status
            }
            // Skip people fields shown above as assignees
            if (field.type === "people") return null;

            const sf = schemaMap.get(field.columnId) || schemaByKey.get(field.key);

            return (
              <div key={field.columnId || field.key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
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
            <p className="text-sm text-muted">No additional fields</p>
          )}
        </div>
      </div>
    </div>
  );
}
