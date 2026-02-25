"use client";

import { BoardItemField, SchemaField, UserProfile } from "@/lib/types";

interface FieldEditorProps {
  field: BoardItemField;
  schema?: SchemaField;
  onUpdate: (value: unknown) => void;
}

export default function FieldEditor({ field, schema, onUpdate }: FieldEditorProps) {
  const type = field.type;

  // Select / Status
  if (type === "select" || type === "status") {
    const options = schema?.options || [];
    const currentValue = Array.isArray(field.value) ? field.value[0] : field.value;
    return (
      <select
        value={(currentValue as string) || ""}
        onChange={(e) => {
          const val = e.target.value;
          onUpdate(val ? [val] : []);
        }}
        className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="">None</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // People (read-only with avatar pills)
  if (type === "people") {
    const people = field.value as string[] | undefined;
    if (!people || people.length === 0) {
      return <span className="text-sm text-muted">No one assigned</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {people.map((userId) => (
          <span
            key={userId}
            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
          >
            {userId}
          </span>
        ))}
      </div>
    );
  }

  // Date
  if (type === "date") {
    return (
      <input
        type="date"
        value={(field.value as string) || ""}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />
    );
  }

  // Text / Rich text
  if (type === "text" || type === "rich_text") {
    return (
      <input
        type="text"
        value={field.displayValue || ""}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />
    );
  }

  // Number
  if (type === "number") {
    return (
      <input
        type="number"
        value={field.displayValue || ""}
        onChange={(e) => onUpdate(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />
    );
  }

  // Unknown / read-only fallback
  return (
    <div className="rounded-md bg-gray-50 px-2 py-1.5 text-sm text-muted">
      {field.displayValue || "—"}
    </div>
  );
}
