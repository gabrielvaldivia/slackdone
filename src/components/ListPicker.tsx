"use client";

import { useEffect, useState } from "react";

interface ListPickerProps {
  workspaceId: string;
  selected: string;
  onChange: (id: string) => void;
}

interface ListInfo {
  id: string;
  title: string;
}

export default function ListPicker({
  workspaceId,
  selected,
  onChange,
}: ListPickerProps) {
  const [lists, setLists] = useState<ListInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setLists([]);
      return;
    }
    setLoading(true);
    fetch(`/api/lists?workspaceId=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => setLists(data.lists || []))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (!workspaceId) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border bg-transparent px-2 py-1 text-sm outline-none"
        disabled={loading}
      >
        <option value="">{loading ? "Loading..." : "Select list"}</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title}
          </option>
        ))}
      </select>

      <button
        onClick={() => setShowManual(!showManual)}
        className="text-xs text-muted hover:text-foreground transition-colors"
      >
        {showManual ? "Hide" : "Enter ID"}
      </button>

      {showManual && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualId.trim()) {
              onChange(manualId.trim());
              setManualId("");
              setShowManual(false);
            }
          }}
          className="flex items-center gap-1"
        >
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="List ID"
            className="border border-border bg-transparent px-2 py-1 text-xs outline-none w-40"
          />
          <button
            type="submit"
            className="border border-border px-2 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
          >
            Go
          </button>
        </form>
      )}
    </div>
  );
}
