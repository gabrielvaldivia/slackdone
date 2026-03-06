"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import EmptyState from "@/components/EmptyState";
import Board from "@/components/Board";
import { UnifiedBoardData } from "@/lib/types";

import { useDialKit } from "dialkit";

interface WorkspaceInfo {
  id: string;
  name: string;
}

interface UserInfo {
  userId: string;
  name: string;
  avatar: string;
}

export default function Home() {
  const [hasEnvVars, setHasEnvVars] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [boardData, setBoardData] = useState<UnifiedBoardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      const data = await res.json();
      setHasEnvVars(data.configured !== false);
      setWorkspaces(data.workspaces || []);
    } catch {
      setHasEnvVars(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      window.history.replaceState({}, "", "/");
    }
  }, [fetchWorkspaces]);

  const boardDataRef = useRef(boardData);
  boardDataRef.current = boardData;

  const fetchBoard = useCallback(async () => {
    const isRefresh = !!boardDataRef.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const res = await fetch("/api/unified-board");
      if (!res.ok) throw new Error("Failed to load board");
      const data = await res.json();
      setBoardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch board when workspaces are loaded
  useEffect(() => {
    if (workspaces.length > 0) {
      fetchBoard();
    }
  }, [workspaces, fetchBoard]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (workspaces.length === 0) return;
    const interval = setInterval(fetchBoard, 30000);
    return () => clearInterval(interval);
  }, [workspaces, fetchBoard]);

  const handleConnect = () => {
    window.location.href = "/api/auth/install";
  };

  const handleDisconnect = async (workspaceId: string) => {
    await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    fetchBoard();
  };

  const handleLogout = async () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    document.body.appendChild(form);
    form.submit();
  };

  const handleListAdded = () => {
    fetchBoard();
  };

  const devDials = useDialKit("Page", { simulateEmpty: false });
  const devEmpty = devDials.simulateEmpty as boolean;
  const hasLists = boardData && boardData.lists && boardData.lists.length > 0;
  const showEmptyState = devEmpty || (!loading && (!boardData || !hasLists));

  return (
    <div className="flex h-dvh flex-col">
      <Header
        workspaces={workspaces}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        refreshing={refreshing}
        onListAdded={handleListAdded}
        lists={boardData?.lists || []}
        onListRemoved={fetchBoard}
        user={user}
        onLogout={handleLogout}
      />

      {error && (
        <div className="border-b border-border px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && !boardData && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      )}

      {showEmptyState && (
        <EmptyState
          hasEnvVars={hasEnvVars}
          hasWorkspaces={workspaces.length > 0}
          onConnect={handleConnect}
          onListAdded={handleListAdded}
          workspaces={workspaces}
        />
      )}

      {boardData && hasLists && !devEmpty && (
        <Board data={boardData} onRefresh={fetchBoard} />
      )}
    </div>
  );
}
