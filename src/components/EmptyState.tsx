"use client";

import { useRef, useState } from "react";
import { useDialKit } from "dialkit";

interface EmptyStateProps {
  hasEnvVars: boolean;
  hasWorkspaces: boolean;
  onConnect: () => void;
  onListAdded: () => void;
  workspaces: { id: string; name: string }[];
}

function parseListInput(input: string): { listId: string; teamId: string | null } | null {
  const trimmed = input.trim();
  if (/^F[A-Z0-9]+$/.test(trimmed)) return { listId: trimmed, teamId: null };
  const match = trimmed.match(/slack\.com\/lists\/(T[A-Z0-9]+)\/(F[A-Z0-9]+)/);
  if (match) return { teamId: match[1], listId: match[2] };
  const listOnly = trimmed.match(/slack\.com\/lists\/[^/]+\/(F[A-Z0-9]+)/);
  if (listOnly) return { listId: listOnly[1], teamId: null };
  return null;
}

function useDevDials(setInput: (v: string) => void, setError: (v: string) => void, setNeedsWorkspace: (v: boolean) => void) {
  const dials = useDialKit("Empty State", {
    fillInvalidURL: { type: "action" },
    fillValidSlackURL: { type: "action" },
    showNeedsWorkspace: { type: "action" },
    showInvalidError: { type: "action" },
  }, {
    onAction: (action: string) => {
      if (action === "fillInvalidURL") {
        setInput("https://notion.so/some-random-page");
        setError("");
        setNeedsWorkspace(false);
      }
      if (action === "fillValidSlackURL") {
        setInput("https://app.slack.com/lists/T00000000/F00000000");
        setError("");
        setNeedsWorkspace(false);
      }
      if (action === "showNeedsWorkspace") {
        setNeedsWorkspace(true);
        setError("");
      }
      if (action === "showInvalidError") {
        setError("Paste a Slack list URL or ID");
        setNeedsWorkspace(false);
      }
    },
  });
  return dials;
}

export default function EmptyState({
  hasEnvVars,
  hasWorkspaces,
  onConnect,
  onListAdded,
  workspaces,
}: EmptyStateProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useDevDials(setInput, setError, setNeedsWorkspace);

  if (!hasEnvVars) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="text-lg font-medium">Setup Required</h2>
          <div className="space-y-2 text-sm text-muted-foreground text-left">
            <p>
              Add these environment variables (Vercel dashboard or{" "}
              <span className="font-mono text-xs">.env.local</span>):
            </p>
            <pre className="mt-3 rounded border border-border bg-gray-50 p-3 text-xs text-left">
              {`SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    const parsed = parseListInput(input);
    if (!parsed) {
      setError("Paste a Slack list URL or ID");
      return;
    }

    if (!hasWorkspaces) {
      setNeedsWorkspace(true);
      return;
    }

    let wsId = workspaces[0]?.id;
    if (parsed.teamId) {
      const match = workspaces.find((w) => w.id === parsed.teamId);
      if (!match) {
        setError("Workspace not connected for this list");
        return;
      }
      wsId = match.id;
    }
    if (!wsId) {
      setError("No workspace");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let title = parsed.listId;
      try {
        const res = await fetch(`/api/lists/${parsed.listId}?workspaceId=${wsId}`);
        if (res.ok) {
          const d = await res.json();
          if (d.listTitle) title = d.listTitle;
        }
      } catch { /* fallback */ }
      await fetch(`/api/workspaces/${wsId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: parsed.listId, title }),
      });
      setInput("");
      setSaving(false);
      setNeedsWorkspace(false);
      onListAdded();
    } catch {
      setError("Failed to add list");
      setSaving(false);
    }
  };

  if (needsWorkspace) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-4 text-center px-4">
          <div className="text-sm text-muted-foreground">Step 2 of 2</div>
          <h2 className="text-lg font-medium">Connect your workspace</h2>
          <p className="text-sm text-muted-foreground">
            Sign in to the Slack workspace that owns this list so we can access it.
          </p>
          <button
            type="button"
            onClick={onConnect}
            className="w-full rounded-md border border-foreground bg-foreground px-4 py-2 text-sm text-background hover:bg-transparent hover:text-foreground transition-colors"
          >
            Connect workspace
          </button>
          <button
            type="button"
            onClick={() => { setNeedsWorkspace(false); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-4 text-center px-4">
        <div className="text-sm text-muted-foreground">Step 1 of 2</div>
        <h2 className="text-lg font-medium">Add a Slack list</h2>
        <div className="rounded-lg border border-border bg-gray-50 px-4 py-3 text-left">
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal ml-4">
            <li>Open a list in Slack</li>
            <li>Click the <span className="font-medium text-foreground">...</span> menu</li>
            <li>Click <span className="font-medium text-foreground">Share list</span></li>
            <li>Click <span className="font-medium text-foreground">Copy link</span></li>
            <li>Paste it below</li>
          </ol>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError("");
            }}
            placeholder="https://app.slack.com/lists/T.../F..."
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
            disabled={saving}
            autoFocus
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !input.trim()}
            className="w-full rounded-md border border-foreground bg-foreground px-4 py-2 text-sm text-background hover:bg-transparent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? "Adding..." : hasWorkspaces ? "Add list" : "Next"}
          </button>
        </form>
      </div>
    </div>
  );
}
