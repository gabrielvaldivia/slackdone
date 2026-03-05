"use client";

import { useEffect, useState } from "react";

function ApiKeyManager({
  apiKey,
  loading,
  signedOut,
  onGenerate,
  onRevoke,
}: {
  apiKey: string | null;
  loading: boolean;
  signedOut: boolean;
  onGenerate: () => void;
  onRevoke: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const masked = apiKey ? apiKey.slice(0, 8) + "..." + apiKey.slice(-4) : "";

  if (loading) {
    return <p className="text-xs text-neutral-400">Loading...</p>;
  }

  if (signedOut) {
    return (
      <p>
        <a href="/login" className="underline hover:text-neutral-600">
          Sign in
        </a>{" "}
        to generate an API key.
      </p>
    );
  }

  if (apiKey) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-md bg-neutral-50 px-4 py-3 font-mono text-xs">
          {revealed ? apiKey : masked}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRevealed(!revealed)}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
          <button
            onClick={copyKey}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onGenerate}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors"
          >
            Regenerate
          </button>
          <button
            onClick={onRevoke}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            Revoke
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onGenerate}
      className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
    >
      Generate API Key
    </button>
  );
}

function CopySetupPrompt({ apiKey }: { apiKey: string | null }) {
  const [copied, setCopied] = useState(false);

  function buildPrompt() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";
    const key = apiKey || "YOUR_API_KEY";

    return `Set up a Slackdone integration for this project. Do the following:

1. Create a sync script at tasks/sync-slackdone.sh:

#!/bin/bash
# Pull Slackdone tasks into a markdown file
API_URL="${origin}/api/unified-board"
API_KEY="${key}"
OUTPUT="tasks/slackdone.md"

curl -s "$API_URL" -H "x-api-key: $API_KEY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
lines = ['# Slackdone Tasks', '']
for col in data.get('columns', []):
    lines.append(f'## {col[\\\"name\\\"]}')
    for item in col.get('items', []):
        assignees = ', '.join(a['displayName'] for a in item.get('assignees', []))
        suffix = f' ({assignees})' if assignees else ''
        lines.append(f'- {item[\\\"title\\\"]}{suffix}')
    lines.append('')
print('\\\\n'.join(lines))
" > "$OUTPUT"
echo "Synced to $OUTPUT"

2. Make it executable: chmod +x tasks/sync-slackdone.sh

3. Create a Claude Code slash command at .claude/commands/tasks.md with this content:

Run tasks/sync-slackdone.sh to refresh the task data, then read tasks/slackdone.md and summarize my current tasks grouped by status. Highlight anything marked urgent or overdue.

4. Add tasks/slackdone.md to .gitignore (it's generated data).

5. Run the sync script once to verify it works.`;
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-neutral-50 p-4 pr-10 text-xs leading-relaxed whitespace-pre-wrap">
        {buildPrompt()}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/50 transition-colors"
        title="Copy prompt"
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
        )}
      </button>
    </div>
  );
}

export default function DocsPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  async function fetchKey() {
    setLoading(true);
    const res = await fetch("/api/api-key");
    if (res.status === 401) {
      setSignedOut(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setApiKey(data.apiKey ?? null);
    setLoading(false);
  }

  async function generateKey() {
    setLoading(true);
    const res = await fetch("/api/api-key", { method: "POST" });
    const data = await res.json();
    setApiKey(data.apiKey);
    setLoading(false);
  }

  async function revokeKey() {
    setLoading(true);
    await fetch("/api/api-key", { method: "DELETE" });
    setApiKey(null);
    setLoading(false);
  }

  useEffect(() => {
    fetchKey();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors mb-8"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </a>
        <header className="mb-12 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Slackdone API
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Read your Slack Lists data over HTTP.
          </p>
        </header>

        <div className="space-y-12 text-sm leading-relaxed text-neutral-800">
          {/* Overview */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Overview</h2>
            <p>
              The Slackdone API lets you read your board data — columns, items,
              fields, and assignees — as JSON. Use it to sync tasks into a
              second brain, build dashboards, or integrate with automation
              tools.
            </p>
          </section>

          {/* Setup */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Setup</h2>
            <p className="mb-3">
              Your API key is tied to your account — requests authenticate as
              you and return your data.
            </p>
            <ApiKeyManager
              apiKey={apiKey}
              loading={loading}
              signedOut={signedOut}
              onGenerate={generateKey}
              onRevoke={revokeKey}
            />
          </section>

          {/* Authentication */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Authentication</h2>
            <p className="mb-3">
              Pass your API key in the{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                x-api-key
              </code>{" "}
              header:
            </p>
            <pre className="overflow-x-auto rounded-md bg-neutral-50 p-4 text-xs leading-relaxed">
{`curl https://your-app.vercel.app/api/unified-board \\
  -H "x-api-key: your-secret-key"`}
            </pre>
            <p className="mt-3">
              Requests without a valid key return{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                401 Unauthorized
              </code>
              .
            </p>
          </section>

          {/* Endpoints */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Endpoints</h2>
            <div className="space-y-6">
              <Endpoint
                method="GET"
                path="/api/unified-board"
                description="Returns your full board: all columns with their items, list metadata, and schema definitions."
                example={`{
  "columns": [
    {
      "id": "no status",
      "name": "No Status",
      "items": [
        {
          "id": "item-id",
          "title": "Write docs",
          "statusValue": "__none__",
          "fields": [...],
          "assignees": [...]
        }
      ]
    }
  ],
  "lists": [
    {
      "listId": "F07...",
      "listTitle": "My Tasks",
      "workspaceId": "ws-id",
      "workspaceName": "My Workspace"
    }
  ],
  "schema": [...]
}`}
              />

              <Endpoint
                method="GET"
                path="/api/workspaces"
                description="Lists your connected Slack workspaces."
                example={`{
  "configured": true,
  "workspaces": [
    { "id": "ws-id", "name": "My Workspace" }
  ]
}`}
              />

              <Endpoint
                method="POST"
                path="/api/lists/[listId]/items"
                description="Creates a new item in a list. Send workspaceId and fields in the request body."
                example={`// Request body:
{
  "workspaceId": "ws-id",
  "fields": { "name": "New task" }
}`}
              />

              <Endpoint
                method="PATCH"
                path="/api/lists/[listId]/items/[itemId]"
                description="Updates an existing item. Send workspaceId and cells in the request body."
                example={`// Request body:
{
  "workspaceId": "ws-id",
  "cells": { "status": "done" }
}`}
              />

              <Endpoint
                method="DELETE"
                path="/api/lists/[listId]/items/[itemId]?workspaceId=ws-id"
                description="Deletes an item from a list. Pass workspaceId as a query parameter."
              />
            </div>
          </section>

          {/* Quick setup with LLM */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              Quick Setup with an LLM
            </h2>
            <p className="mb-3">
              Copy this prompt and paste it into Claude Code (or any LLM) to
              automatically create a sync script and slash command for your
              project.
            </p>
            <CopySetupPrompt apiKey={apiKey} />
          </section>
        </div>

      </div>
    </div>
  );
}

function Endpoint({
  method,
  path,
  description,
  example,
}: {
  method: string;
  path: string;
  description: string;
  example?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {method}
        </span>
        <code className="text-xs">{path}</code>
      </div>
      <p className="mb-2 text-neutral-600">{description}</p>
      {example && (
        <pre className="overflow-x-auto rounded-md bg-neutral-50 p-4 text-xs leading-relaxed">
          {example}
        </pre>
      )}
    </div>
  );
}
