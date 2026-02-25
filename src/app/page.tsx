"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import EmptyState from "@/components/EmptyState";
import Board from "@/components/Board";
import { BoardData } from "@/lib/types";

interface WorkspaceInfo {
  id: string;
  name: string;
}

export default function Home() {
  const [hasEnvVars, setHasEnvVars] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("slackdone:workspace") || "";
    return "";
  });
  const [selectedList, setSelectedList] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("slackdone:list") || "";
    return "";
  });
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      const data = await res.json();
      setHasEnvVars(data.configured !== false);
      setWorkspaces(data.workspaces || []);
      if (data.workspaces?.length > 0 && !selectedWorkspace) {
        const saved = localStorage.getItem("slackdone:workspace");
        const pick = saved && data.workspaces.some((w: WorkspaceInfo) => w.id === saved)
          ? saved
          : data.workspaces[0].id;
        setSelectedWorkspace(pick);
      }
    } catch {
      setHasEnvVars(false);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
    // Show error from URL params (e.g. OAuth failure)
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
    if (!selectedWorkspace || !selectedList) return;
    const isRefresh = !!boardDataRef.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const res = await fetch(
        `/api/lists/${selectedList}?workspaceId=${selectedWorkspace}`
      );
      if (!res.ok) throw new Error("Failed to load board");
      const data = await res.json();
      setBoardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedWorkspace, selectedList]);

  useEffect(() => {
    fetchBoard();
  }, [selectedWorkspace, selectedList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!selectedWorkspace || !selectedList) return;
    const interval = setInterval(fetchBoard, 30000);
    return () => clearInterval(interval);
  }, [selectedWorkspace, selectedList, fetchBoard]);

  const handleConnect = () => {
    window.location.href = "/api/auth/install";
  };

  const handleDisconnect = async (workspaceId: string) => {
    await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    if (selectedWorkspace === workspaceId) {
      setSelectedWorkspace("");
      setSelectedList("");
      setBoardData(null);
    }
  };

  const showEmptyState = !boardData && !loading;

  return (
    <div className="flex h-screen flex-col">
      <Header
        workspaces={workspaces}
        selectedWorkspace={selectedWorkspace}
        selectedList={selectedList}
        onWorkspaceChange={(id) => {
          setSelectedWorkspace(id);
          setSelectedList("");
          setBoardData(null);
          localStorage.setItem("slackdone:workspace", id);
          localStorage.removeItem("slackdone:list");
        }}
        onListChange={(id) => {
          setSelectedList(id);
          localStorage.setItem("slackdone:list", id);
        }}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        refreshing={refreshing}
      />

      {error && (
        <div className="border-b border-border px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && !boardData && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">Loading...</p>
        </div>
      )}

      {showEmptyState && (
        <EmptyState
          hasEnvVars={hasEnvVars}
          hasWorkspaces={workspaces.length > 0}
          onConnect={handleConnect}
        />
      )}

      {boardData && (
        <Board
          data={boardData}
          workspaceId={selectedWorkspace}
          onRefresh={fetchBoard}
        />
      )}
    </div>
  );
}
