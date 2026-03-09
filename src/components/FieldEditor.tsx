"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BoardItemField, SchemaField } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false });

interface FieldEditorProps {
  field: BoardItemField;
  schema?: SchemaField;
  onUpdate: (value: unknown) => void;
  disablePortal?: boolean;
}

export default function FieldEditor({ field, schema, onUpdate, disablePortal }: FieldEditorProps) {
  const type = field.type;

  // Select / Status
  if (type === "select" || type === "status") {
    const options = schema?.options || [];
    const currentValue = Array.isArray(field.value) ? field.value[0] : field.value;
    return (
      <Select
        value={(currentValue as string) || "_none_"}
        onValueChange={(val) => {
          onUpdate(val === "_none_" ? [] : [val]);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent disablePortal={disablePortal}>
          <SelectItem value="_none_">None</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // People (read-only with avatar pills)
  if (type === "people") {
    const people = field.value as string[] | undefined;
    if (!people || people.length === 0) {
      return <span className="text-sm text-muted-foreground">No one assigned</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {people.map((userId) => (
          <span
            key={userId}
            className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
          >
            {userId}
          </span>
        ))}
      </div>
    );
  }

  // Date
  if (type === "date") {
    return <DateField initialValue={(field.value as string) || ""} onUpdate={onUpdate} />;
  }

  // Number
  if (type === "number") {
    return <NumberField initialValue={field.displayValue || ""} onUpdate={onUpdate} />;
  }

  // Text / Rich text / Message — use tiptap editor
  if (type === "text" || type === "rich_text" || type === "message") {
    return <RichTextEditor initialValue={field.displayValue || ""} onUpdate={(v) => onUpdate(v)} placeholder="Empty" />;
  }

  // Link fields — clickable when not editing
  if (type === "link") {
    return <LinkField initialValue={field.displayValue || ""} onUpdate={onUpdate} />;
  }

  // Unknown and other types — plain text input
  return <StringField initialValue={field.displayValue || ""} onUpdate={onUpdate} />;
}

function DateField({ initialValue, onUpdate }: { initialValue: string; onUpdate: (value: unknown) => void }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Input
      type="date"
      value={value}
      onChange={(e) => { setValue(e.target.value); onUpdate(e.target.value); }}
    />
  );
}

function NumberField({ initialValue, onUpdate }: { initialValue: string; onUpdate: (value: unknown) => void }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Input
      type="number"
      value={value}
      placeholder="Empty"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value !== initialValue) onUpdate(value ? Number(value) : null); }}
    />
  );
}

function LinkField({ initialValue, onUpdate }: { initialValue: string; onUpdate: (value: unknown) => void }) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);

  if (editing || !value) {
    return (
      <Input
        type="url"
        value={value}
        placeholder="Paste a URL…"
        autoFocus={!!value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (value !== initialValue) onUpdate(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); if (value !== initialValue) onUpdate(value); }
          if (e.key === "Escape") { setValue(initialValue); setEditing(false); }
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5 group/link">
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:underline truncate"
      >
        {value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
      </a>
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        title="Edit link"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
    </div>
  );
}

function StringField({ initialValue, onUpdate }: { initialValue: string; onUpdate: (value: unknown) => void }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Input
      type="text"
      value={value}
      placeholder="Empty"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value !== initialValue) onUpdate(value); }}
    />
  );
}

