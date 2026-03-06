"use client";

import { useEffect, useRef, useState } from "react";
import AddListModal from "./AddListModal";

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
  showAddList: boolean;
  onToggleAddList: () => void;
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
  showAddList,
  onToggleAddList,
  onListAdded,
  lists,
  onListRemoved,
  user,
  onLogout,
}: HeaderProps) {
  const [listsOpen, setListsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    if ((window as unknown as Record<string, unknown>).__ELECTRON__ === true) setIsElectron(true);
  }, []);
  const listsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listsRef.current && !listsRef.current.contains(e.target as Node)) setListsOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
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
        {/* Combined lists & workspaces dropdown */}
        {(workspaces.length > 0 || lists.length > 0) ? (
          <div className="relative" ref={listsRef}>
            <button onClick={() => setListsOpen((v) => !v)} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 transition-colors">
              Lists
            </button>
            {listsOpen && <div className="absolute right-0 top-full z-10 min-w-[240px] pt-1">
              <div className="rounded-md ring-1 ring-border bg-white shadow-md">
                {(() => {
                  // Group lists by workspace, include workspaces with no lists
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
                  return Array.from(grouped.values()).map((ws, i) => (
                    <div key={ws.workspaceId} className={i > 0 ? "mt-2" : ""}>
                      <div className="group/ws flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 transition-colors">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {ws.workspaceName}
                        </span>
                        <button
                          onClick={() => onDisconnect(ws.workspaceId)}
                          className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/ws:opacity-100"
                          title="Disconnect workspace"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6a5 5 0 0 1 0-10h3" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                            <line x1="2" y1="2" x2="22" y2="22" />
                          </svg>
                        </button>
                      </div>
                      {ws.lists.map((list) => (
                        <div
                          key={`${list.workspaceId}-${list.listId}`}
                          className="group/item flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                        >
                          <span className="truncate">{list.listTitle}</span>
                          <button
                            onClick={(e) =>
                              handleRemoveList(list.workspaceId, list.listId, e)
                            }
                            className="ml-2 shrink-0 flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/item:opacity-100"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {ws.lists.length === 0 && (
                        <div className="px-3 py-1.5 text-xs text-muted-foreground italic">No lists</div>
                      )}
                    </div>
                  ));
                })()}
                <div className="border-t border-border flex">
                  <button
                    onClick={onToggleAddList}
                    className="flex-1 px-3 py-2 text-xs text-center hover:bg-gray-50"
                  >
                    + List
                  </button>
                  <button
                    onClick={onConnect}
                    className="flex-1 px-3 py-2 text-xs text-center hover:bg-gray-50 border-l border-border"
                  >
                    + Workspace
                  </button>
                </div>
              </div>
            </div>}
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
          >
            + Connect workspace
          </button>
        )}

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
                  {!isElectron && (
                    <a
                      href="https://github.com/gabrielvaldivia/slackdone/releases/latest"
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

      {showAddList && (
        <AddListModal
          workspaces={workspaces}
          onClose={() => onToggleAddList()}
          onAdded={onListAdded}
        />
      )}
    </header>
  );
}
