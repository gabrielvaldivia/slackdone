"use client";

import { useState } from "react";

interface AddListModalProps {
  workspaces: { id: string; name: string }[];
  onClose: () => void;
  onAdded: () => void;
}

function parseListInput(input: string): { listId: string; teamId: string | null } | null {
  const trimmed = input.trim();
  if (/^F[A-Z0-9]+$/.test(trimmed)) return { listId: trimmed, teamId: null };
  const match = trimmed.match(/slack\.com\/lists\/(T[A-Z0-9]+)\/(F[A-Z0-9]+)/);
  if (match) return { teamId: match[1], listId: match[2] };
  // Fallback: just extract the list ID without team
  const listOnly = trimmed.match(/slack\.com\/lists\/[^/]+\/(F[A-Z0-9]+)/);
  if (listOnly) return { listId: listOnly[1], teamId: null };
  return null;
}

export default function AddListModal({
  workspaces,
  onClose,
  onAdded,
}: AddListModalProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleInputChange = (value: string) => {
    setInput(value);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseListInput(input);
    if (!parsed) {
      setError("Paste a Slack list URL or list ID (starts with F)");
      return;
    }

    // Match workspace from URL team ID, or use the only workspace
    let wsId: string | undefined;
    if (parsed.teamId) {
      const match = workspaces.find((w) => w.id === parsed.teamId);
      if (!match) {
        setError("This list belongs to a workspace you haven't connected. Add the workspace first.");
        return;
      }
      wsId = match.id;
    } else if (workspaces.length === 1) {
      wsId = workspaces[0].id;
    } else {
      setError("Paste a full Slack list URL so we can detect the workspace.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Fetch list to get the real title
      let title = parsed.listId;
      try {
        const listRes = await fetch(
          `/api/lists/${parsed.listId}?workspaceId=${wsId}`
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.listTitle) title = listData.listTitle;
        }
      } catch {
        // Fall back to using the ID as title
      }

      // Save the list reference
      await fetch(`/api/workspaces/${wsId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: parsed.listId, title }),
      });
      onAdded();
    } catch {
      setError("Failed to add list");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold mb-4">Add a Slack List</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p>To get a list link:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Open the list in Slack</li>
              <li>Click the <span className="font-medium text-foreground">...</span> menu</li>
              <li>Click <span className="font-medium text-foreground">Share list</span></li>
              <li>Click <span className="font-medium text-foreground">Copy link</span></li>
            </ol>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Slack List URL or ID
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="https://app.slack.com/lists/T.../F... or F..."
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add List"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
