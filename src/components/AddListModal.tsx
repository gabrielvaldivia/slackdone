"use client";

import { useState } from "react";

interface AddListModalProps {
  workspaces: { id: string; name: string }[];
  onClose: () => void;
  onAdded: () => void;
}

function parseListId(input: string): string | null {
  const trimmed = input.trim();
  if (/^F[A-Z0-9]+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/slack\.com\/lists\/[^/]+\/(F[A-Z0-9]+)/);
  if (match) return match[1];
  return null;
}

export default function AddListModal({
  workspaces,
  onClose,
  onAdded,
}: AddListModalProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    workspaces.length === 1 ? workspaces[0].id : ""
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const listId = parseListId(input);
    if (!listId) {
      setError("Paste a Slack list URL or list ID (starts with F)");
      return;
    }
    if (!selectedWorkspace) {
      setError("Select a workspace");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Save the list reference
      await fetch(`/api/workspaces/${selectedWorkspace}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, title: listId }),
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
          {workspaces.length > 1 && (
            <div>
              <label className="block text-xs text-muted mb-1">
                Workspace
              </label>
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select workspace...</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1">
              Slack List URL or ID
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
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
