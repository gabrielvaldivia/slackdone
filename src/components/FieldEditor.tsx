"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BoardItemField, SchemaField } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
      <Select
        value={(currentValue as string) || "_none_"}
        onValueChange={(val) => {
          onUpdate(val === "_none_" ? [] : [val]);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
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
    return (
      <Input
        type="date"
        value={(field.value as string) || ""}
        onChange={(e) => onUpdate(e.target.value)}
      />
    );
  }

  // Text / Rich text
  if (type === "text" || type === "rich_text") {
    return <TextAreaField initialValue={field.displayValue || ""} onUpdate={onUpdate} />;
  }

  // Number
  if (type === "number") {
    return (
      <Input
        type="number"
        value={field.displayValue || ""}
        onChange={(e) => onUpdate(e.target.value ? Number(e.target.value) : null)}
      />
    );
  }

  // Unknown / read-only fallback
  return (
    <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
      {field.displayValue || "—"}
    </div>
  );
}

function TextAreaField({ initialValue, onUpdate }: { initialValue: string; onUpdate: (value: unknown) => void }) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleBlur = () => {
    setEditing(false);
    if (value !== initialValue) {
      onUpdate(value);
    }
  };

  const startEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    });
  };

  if (editing) {
    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        rows={5}
        placeholder="Add notes... (Markdown supported)"
        className="resize-y font-mono text-sm"
      />
    );
  }

  if (!value.trim()) {
    return (
      <button
        onClick={startEditing}
        className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        Add notes...
      </button>
    );
  }

  return (
    <button
      onClick={startEditing}
      className="w-full overflow-hidden rounded-md bg-secondary px-3 py-2 text-left text-sm hover:bg-accent transition-colors cursor-text"
    >
      <div className="prose prose-sm max-w-none break-words prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-1 prose-blockquote:my-1 prose-a:break-all">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    </button>
  );
}
