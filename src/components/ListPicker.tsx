"use client";

import { useState } from "react";

interface ListPickerProps {
  workspaceId: string;
  selected: string;
  onChange: (id: string) => void;
}

function parseListId(input: string): string | null {
  const trimmed = input.trim();
  // Direct ID like F09DT4E8K40
  if (/^F[A-Z0-9]+$/.test(trimmed)) return trimmed;
  // Slack URL like https://xxx.slack.com/lists/T.../F09DT4E8K40
  const match = trimmed.match(/slack\.com\/lists\/[^/]+\/(F[A-Z0-9]+)/);
  if (match) return match[1];
  return null;
}

export default function ListPicker({
  workspaceId,
  selected,
  onChange,
}: ListPickerProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  if (!workspaceId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseListId(input);
    if (id) {
      onChange(id);
      setInput("");
      setError("");
    } else {
      setError("Paste a Slack list URL or list ID");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {selected && (
        <span className="text-xs text-muted">{selected}</span>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
          }}
          placeholder={selected ? "Change list (URL or ID)" : "Paste Slack list URL or ID"}
          className="border border-border bg-transparent px-2 py-1 text-xs outline-none w-56 placeholder:text-muted"
        />
        <button
          type="submit"
          className="border border-border px-2 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
        >
          Go
        </button>
      </form>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
