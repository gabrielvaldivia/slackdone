"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ListInfo {
  listId: string;
  listTitle: string;
  workspaceId: string;
  workspaceName: string;
}

interface UserInfo {
  userId: string;
  name: string;
  avatar: string;
}

interface HeaderProps {
  workspaces: { id: string; name: string }[];
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  refreshing?: boolean;
  onListAdded: () => void;
  lists: ListInfo[];
  onListRemoved: () => void;
  user?: UserInfo | null;
  onLogout?: () => void;
}

export default function Header({
  workspaces,
  onConnect,
  onDisconnect,
  refreshing,
  onListAdded,
  lists,
  onListRemoved,
  user,
  onLogout,
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [manageListsOpen, setManageListsOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [addListInput, setAddListInput] = useState("");
  const [addListError, setAddListError] = useState("");
  const [addListSaving, setAddListSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const addListRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  const helpPopoverRef = useRef<HTMLDivElement>(null);
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    if ((window as unknown as Record<string, unknown>).__ELECTRON__ === true) setIsElectron(true);
  }, []);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) setWsMenuOpen(false);
      if (helpPopoverRef.current && !helpPopoverRef.current.contains(e.target as Node) && helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRemoveList = async (
    workspaceId: string,
    listId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      await fetch(`/api/workspaces/${workspaceId}/lists`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
      });
      onListRemoved();
    } catch {
      // ignore
    }
  };

  const parseListInput = (input: string): { listId: string; teamId: string | null } | null => {
    const trimmed = input.trim();
    if (/^F[A-Z0-9]+$/.test(trimmed)) return { listId: trimmed, teamId: null };
    const match = trimmed.match(/slack\.com\/lists\/(T[A-Z0-9]+)\/(F[A-Z0-9]+)/);
    if (match) return { teamId: match[1], listId: match[2] };
    const listOnly = trimmed.match(/slack\.com\/lists\/[^/]+\/(F[A-Z0-9]+)/);
    if (listOnly) return { listId: listOnly[1], teamId: null };
    return null;
  };

  const handleAddListSubmit = async () => {
    const parsed = parseListInput(addListInput);
    if (!parsed) { setAddListError("Paste a Slack list URL or ID"); return; }
    let wsId = selectedWorkspaceId || workspaces[0]?.id;
    if (parsed.teamId) {
      const match = workspaces.find((w) => w.id === parsed.teamId);
      if (!match) { setAddListError("Workspace not connected"); return; }
      wsId = match.id;
    }
    if (!wsId) { setAddListError("No workspace"); return; }
    setAddListSaving(true);
    setAddListError("");
    try {
      let title = parsed.listId;
      try {
        const res = await fetch(`/api/lists/${parsed.listId}?workspaceId=${wsId}`);
        if (res.ok) { const d = await res.json(); if (d.listTitle) title = d.listTitle; }
      } catch { /* fallback */ }
      await fetch(`/api/workspaces/${wsId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: parsed.listId, title }),
      });
      setAddingList(false);
      setAddListInput("");
      setAddListSaving(false);
      onListAdded();
    } catch {
      setAddListError("Failed to add list");
      setAddListSaving(false);
    }
  };

  return (
    <header className={`flex items-center justify-between border-b border-border bg-white px-4 py-3 ${isElectron ? "pl-20" : ""}`} style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <div className="flex items-center gap-4">
        {!isElectron && (
          <h1 className="text-sm font-semibold tracking-tight">
            Slackdone
          </h1>
        )}
        {refreshing && (
          <span className="text-[10px] font-normal text-muted-foreground">
            syncing...
          </span>
        )}
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {/* User menu */}
        {user && (
          <div className="relative ml-2" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center justify-center rounded-full hover:ring-2 hover:ring-gray-200 transition-all overflow-hidden"
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                  {user.name[0]}
                </span>
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full z-10 min-w-[160px] pt-1">
                <div className="rounded-md ring-1 ring-border bg-white shadow-md py-1">
                  <button
                    onClick={() => { setManageListsOpen(true); setUserMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 whitespace-nowrap"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    Manage lists
                  </button>
                  {!isElectron && (
                    <a
                      href="/api/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 whitespace-nowrap"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download app
                    </a>
                  )}
                  <a
                    href="/docs"
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 whitespace-nowrap"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    API Docs
                  </a>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 text-red-600 whitespace-nowrap"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manage lists dialog */}
      {manageListsOpen && (() => {
        const grouped = new Map<string, { workspaceId: string; workspaceName: string; lists: ListInfo[] }>();
        for (const w of workspaces) {
          grouped.set(w.id, { workspaceId: w.id, workspaceName: w.name, lists: [] });
        }
        for (const list of lists) {
          const entry = grouped.get(list.workspaceId);
          if (entry) {
            entry.lists.push(list);
          } else {
            grouped.set(list.workspaceId, { workspaceId: list.workspaceId, workspaceName: list.workspaceName, lists: [list] });
          }
        }
        const groups = Array.from(grouped.values());
        const activeWsId = selectedWorkspaceId || groups[0]?.workspaceId || null;
        const activeWs = groups.find((g) => g.workspaceId === activeWsId) || null;

        const closeDialog = () => { setManageListsOpen(false); setSelectedWorkspaceId(null); };
        const mobileView = selectedWorkspaceId ? "workspace" : "workspaces";

        // Shared content pieces
        const workspaceListContent = (ws: typeof activeWs) => ws && (
          <>
            <div className="flex-1 overflow-y-auto">
              {ws.lists.map((list) => (
                <div
                  key={`${list.workspaceId}-${list.listId}`}
                  className="flex items-center justify-between px-4 py-2 text-xs hover:bg-gray-50 transition-colors"
                >
                  <span className="truncate">{list.listTitle}</span>
                  <button
                    onClick={(e) => handleRemoveList(list.workspaceId, list.listId, e)}
                    className="ml-2 shrink-0 flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-red-600 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
              {addingList ? (
                <div className="px-4 py-2">
                  <form onSubmit={(e) => { e.preventDefault(); handleAddListSubmit(); }}>
                    <input
                      ref={addListRef}
                      type="text"
                      value={addListInput}
                      onChange={(e) => { setAddListInput(e.target.value); setAddListError(""); }}
                      placeholder="Paste Slack list URL..."
                      className="w-full rounded-md border border-border px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                      autoFocus
                      disabled={addListSaving}
                      onKeyDown={(e) => { if (e.key === "Escape") { setAddingList(false); setAddListInput(""); setAddListError(""); } }}
                    />
                    {addListError && <p className="mt-1 text-[10px] text-red-600">{addListError}</p>}
                  </form>
                  <div className="mt-1">
                    <button
                      ref={helpRef}
                      type="button"
                      onClick={() => setShowHelp((v) => !v)}
                      className="text-[10px] text-blue-600 hover:text-blue-700"
                    >
                      How to get a list link
                    </button>
                    {showHelp && createPortal(
                      <div
                        ref={helpPopoverRef}
                        className="fixed z-[100] w-56 rounded-lg ring-1 ring-border bg-white p-3 shadow-lg text-[11px] text-muted-foreground space-y-1"
                        style={(() => {
                          const rect = helpRef.current?.getBoundingClientRect();
                          return rect ? { top: rect.top - 4, left: rect.left, transform: "translateY(-100%)" } : {};
                        })()}
                      >
                        <ol className="list-decimal ml-3 space-y-0.5">
                          <li>Open the list in Slack</li>
                          <li>Click the <span className="font-medium text-foreground">...</span> menu</li>
                          <li>Click <span className="font-medium text-foreground">Share list</span></li>
                          <li>Click <span className="font-medium text-foreground">Copy link</span></li>
                        </ol>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingList(true); setTimeout(() => addListRef.current?.focus(), 0); }}
                  className="w-full px-4 py-2 text-xs text-blue-600 hover:bg-gray-50 transition-colors text-left"
                >
                  + Add list
                </button>
              )}
            </div>
          </>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40" onClick={closeDialog}>
            {/* Desktop: two-column dialog */}
            <div className="hidden sm:block w-full max-w-md rounded-xl bg-white shadow-xl ring-1 ring-border overflow-hidden" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => {
              if (showHelp && helpPopoverRef.current && !helpPopoverRef.current.contains(e.target as Node) && helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
            }}>
              <div className="flex h-72">
                {/* Left: workspaces */}
                <div className="w-40 shrink-0 border-r border-border flex flex-col">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Workspaces</div>
                  <div className="flex-1 overflow-y-auto">
                    {groups.map((ws) => (
                      <button
                        key={ws.workspaceId}
                        onClick={() => { setSelectedWorkspaceId(ws.workspaceId); setAddingList(false); setAddListInput(""); setAddListError(""); setWsMenuOpen(false); }}
                        className={`flex w-full items-center px-3 py-2 text-xs transition-colors ${
                          activeWsId === ws.workspaceId ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate">{ws.workspaceName}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => { onConnect(); closeDialog(); }}
                      className="w-full px-3 py-2 text-xs text-blue-600 hover:bg-gray-50 transition-colors text-left"
                    >
                      + Add workspace
                    </button>
                  </div>
                </div>
                {/* Right: lists for selected workspace */}
                <div className="flex-1 flex flex-col min-w-0">
                  {activeWs ? (
                    <>
                      <div className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold">{activeWs.workspaceName}</span>
                          <div className="relative" ref={wsMenuRef}>
                            <button onClick={() => setWsMenuOpen((v) => !v)} className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="19" r="1" />
                              </svg>
                            </button>
                            {wsMenuOpen && (
                              <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px]">
                                <div className="rounded-md ring-1 ring-border bg-white shadow-md py-1">
                                  <button
                                    onClick={() => { setWsMenuOpen(false); onDisconnect(activeWs.workspaceId); }}
                                    className="w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-gray-50 transition-colors"
                                  >
                                    Remove workspace
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={closeDialog} className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                      {workspaceListContent(activeWs)}
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                      No workspaces connected
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile: bottom sheet with push navigation */}
            <div className="sm:hidden w-full min-h-[50vh] rounded-t-xl bg-white shadow-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => {
              if (showHelp && helpPopoverRef.current && !helpPopoverRef.current.contains(e.target as Node) && helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
            }}>
              {mobileView === "workspaces" ? (
                <>
                  <div className="relative flex items-center justify-center px-4 py-3">
                    <span className="text-sm font-semibold">Workspaces</span>
                    <button onClick={closeDialog} className="absolute right-4 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {groups.map((ws) => (
                      <button
                        key={ws.workspaceId}
                        onClick={() => { setSelectedWorkspaceId(ws.workspaceId); setAddingList(false); setAddListInput(""); setAddListError(""); setWsMenuOpen(false); }}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <span className="truncate">{ws.workspaceName}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    ))}
                    <button
                      onClick={() => { onConnect(); closeDialog(); }}
                      className="w-full px-4 py-3 text-sm text-blue-600 hover:bg-gray-50 transition-colors text-left"
                    >
                      + Add workspace
                    </button>
                  </div>
                  <div className="pb-[env(safe-area-inset-bottom)]" />
                </>
              ) : activeWs && (
                <>
                  <div className="relative flex items-center justify-center px-4 py-3">
                    <button onClick={() => { setSelectedWorkspaceId(null); setAddingList(false); setAddListInput(""); setAddListError(""); setWsMenuOpen(false); }} className="absolute left-4 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{activeWs.workspaceName}</span>
                      <div className="relative" ref={wsMenuRef}>
                        <button onClick={() => setWsMenuOpen((v) => !v)} className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </button>
                        {wsMenuOpen && (
                          <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px]">
                            <div className="rounded-md ring-1 ring-border bg-white shadow-md py-1">
                              <button
                                onClick={() => { setWsMenuOpen(false); onDisconnect(activeWs.workspaceId); }}
                                className="w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-gray-50 transition-colors"
                              >
                                Remove workspace
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={closeDialog} className="absolute right-4 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-col max-h-64">
                    {workspaceListContent(activeWs)}
                  </div>
                  <div className="pb-[env(safe-area-inset-bottom)]" />
                </>
              )}
            </div>
          </div>
        );
      })()}
    </header>
  );
}
