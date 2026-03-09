"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
      })
      .catch((err) => {
        setError(err.message || "Failed to load shared board");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-dvh flex-col">
        <SharedHeader viewName="" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !boardData) {
    return (
      <div className="flex h-dvh flex-col">
        <SharedHeader viewName="" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {error || "Shared board not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <SharedHeader viewName={view?.name || "Shared View"} />
      <Board
        data={boardData}
        onRefresh={() => {}}
        readOnly
        initialView={view || undefined}
      />
    </div>
  );
}

function SharedHeader({ viewName }: { viewName: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Slackdone</span>
        {viewName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{viewName}</span>
          </>
        )}
      </div>
      <span className="text-xs text-muted-foreground">Read-only</span>
    </header>
  );
}
