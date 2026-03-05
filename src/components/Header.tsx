"use client";

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
    <header className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold tracking-tight">
          Slackdone
          {refreshing && (
            <span className="ml-2 text-[10px] font-normal text-muted">
              syncing...
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Combined lists & workspaces dropdown */}
        {(workspaces.length > 0 || lists.length > 0) ? (
          <div className="relative group">
            <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 transition-colors">
              Lists
            </button>
            <div className="absolute right-0 top-full z-10 hidden group-hover:block min-w-[240px] pt-1">
              <div className="rounded-md border border-border bg-white shadow-md">
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
                  return Array.from(grouped.values()).map((ws) => (
                    <div key={ws.workspaceId}>
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                          {ws.workspaceName}
                        </span>
                        <button
                          onClick={() => onDisconnect(ws.workspaceId)}
                          className="text-[10px] text-muted hover:text-red-600 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                      {ws.lists.map((list) => (
                        <div
                          key={`${list.workspaceId}-${list.listId}`}
                          className="group/item flex items-center justify-between px-3 py-1.5 text-xs"
                        >
                          <span className="truncate">{list.listTitle}</span>
                          <button
                            onClick={(e) =>
                              handleRemoveList(list.workspaceId, list.listId, e)
                            }
                            className="ml-2 shrink-0 text-muted hover:text-red-600 transition-colors opacity-0 group-hover/item:opacity-100"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {ws.lists.length === 0 && (
                        <div className="px-3 py-1.5 text-xs text-muted italic">No lists</div>
                      )}
                    </div>
                  ));
                })()}
                <div className="border-t border-border flex">
                  <button
                    onClick={onToggleAddList}
                    className="flex-1 px-3 py-2 text-xs text-left hover:bg-gray-50"
                  >
                    + List
                  </button>
                  <button
                    onClick={onConnect}
                    className="flex-1 px-3 py-2 text-xs text-left hover:bg-gray-50 border-l border-border"
                  >
                    + Workspace
                  </button>
                </div>
              </div>
            </div>
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
          <div className="relative group ml-2">
            <button className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-gray-50 transition-colors">
              {user.avatar && (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-4 w-4 rounded-full"
                />
              )}
              <span className="max-w-[100px] truncate">{user.name}</span>
            </button>
            <div className="absolute right-0 top-full z-10 hidden group-hover:block min-w-[120px] pt-1">
              <div className="rounded-md border border-border bg-white shadow-md">
                <a
                  href="/docs"
                  className="block w-full px-3 py-2 text-xs text-left hover:bg-gray-50"
                >
                  API Docs
                </a>
                <button
                  onClick={onLogout}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 text-red-600"
                >
                  Sign out
                </button>
              </div>
            </div>
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
