"use client";

import { useCallback, useEffect, useState } from "react";
import { SavedList } from "@/lib/types";

interface ListPickerProps {
  workspaceId: string;
  selected: string;
  onChange: (id: string) => void;
  boardTitle?: string;
}

function parseListId(input: string): string | null {
  const trimmed = input.trim();
  if (/^F[A-Z0-9]+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/slack\.com\/lists\/[^/]+\/(F[A-Z0-9]+)/);
  if (match) return match[1];
  return null;
}

export default function ListPicker({
  workspaceId,
  selected,
  onChange,
  boardTitle,
}: ListPickerProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);

  const fetchSavedLists = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/lists`);
      const data = await res.json();
      setSavedLists(data.lists || []);
    } catch {
      // ignore
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchSavedLists();
  }, [fetchSavedLists]);

  // Auto-save when board loads with a title
  useEffect(() => {
    if (!workspaceId || !selected || !boardTitle) return;
    const alreadySaved = savedLists.some((l) => l.listId === selected);
    if (alreadySaved) return;
    fetch(`/api/workspaces/${workspaceId}/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: selected, title: boardTitle }),
    }).then(() => fetchSavedLists());
  }, [workspaceId, selected, boardTitle, savedLists, fetchSavedLists]);

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

  const handleRemove = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/workspaces/${workspaceId}/lists`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
      });
      setSavedLists((prev) => prev.filter((l) => l.listId !== listId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      {savedLists.length > 0 && (
        <div className="flex items-center gap-1">
          {savedLists.map((list) => (
            <button
              key={list.listId}
              onClick={() => onChange(list.listId)}
              className={`group flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                selected === list.listId
                  ? "bg-foreground text-background"
                  : "bg-white text-foreground hover:bg-gray-100 border border-border"
              }`}
            >
              <span className="max-w-[120px] truncate">{list.title}</span>
              <span
                onClick={(e) => handleRemove(list.listId, e)}
                className={`ml-0.5 hidden group-hover:inline-flex items-center justify-center rounded-full w-3.5 h-3.5 text-[10px] leading-none hover:bg-red-500 hover:text-white ${
                  selected === list.listId ? "text-background/60" : "text-muted"
                }`}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
          }}
          placeholder={savedLists.length > 0 ? "Add list..." : "Paste Slack list URL or ID"}
          className="rounded-md border border-border bg-white px-2 py-1 text-xs outline-none w-44 placeholder:text-muted focus:ring-2 focus:ring-blue-300"
        />
        <button
          type="submit"
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
        >
          Go
        </button>
      </form>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
