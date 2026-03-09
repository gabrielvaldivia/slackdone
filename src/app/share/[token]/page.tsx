"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Board from "@/components/Board";
import { UnifiedBoardData } from "@/lib/types";

interface SharedView {
  name: string;
  assignees: string[];
  clients: string[];
  properties?: string[];
}

export default function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const [boardData, setBoardData] = useState<UnifiedBoardData | null>(null);
  const [view, setView] = useState<SharedView | null>(null);
  const [mode, setMode] = useState<"readonly" | "edit">("readonly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBoard = useCallback(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Not found");
        }
        return res.json();
      })
      .then((data) => {
        setBoardData(data.board);
        setView(data.view);
        setMode(data.mode || "readonly");
      })
      .catch((err) => {
        setError(err.message || "Failed to load shared board");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  if (loading) {
    return (
      <div className="flex h-dvh flex-col">
        <SharedHeader viewName="" mode="readonly" searchQuery="" onSearchChange={() => {}} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !boardData) {
    return (
      <div className="flex h-dvh flex-col">
        <SharedHeader viewName="" mode="readonly" searchQuery="" onSearchChange={() => {}} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {error || "Shared board not found"}
          </p>
        </div>
      </div>
    );
  }

  const isReadOnly = mode === "readonly";

  return (
    <div className="flex h-dvh flex-col">
      <SharedHeader
        viewName={view?.name || "Shared View"}
        mode={mode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <Board
        data={boardData}
        onRefresh={fetchBoard}
        readOnly={isReadOnly}
        initialView={view || undefined}
        shareToken={isReadOnly ? undefined : token}
        externalSearch={searchQuery}
        onExternalSearchChange={setSearchQuery}
        isSharedView
      />
    </div>
  );
}

function SharedHeader({
  viewName,
  mode,
  searchQuery,
  onSearchChange,
}: {
  viewName: string;
  mode: "readonly" | "edit";
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <Image src="/logo.png" alt="Slackdone" width={20} height={20} className="rounded" />
        <span className="text-sm font-semibold">Slackdone</span>
        {viewName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{viewName}</span>
            {mode === "readonly" && (
              <span className="text-xs text-muted-foreground">(read-only)</span>
            )}
          </>
        )}
      </div>
      <div className="relative">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="h-7 w-44 rounded-full border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
