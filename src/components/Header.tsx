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

        {/* Lists dropdown */}
        {lists.length > 0 && (
          <div className="relative group">
            <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 transition-colors">
              {lists.length} list{lists.length !== 1 ? "s" : ""}
            </button>
            <div className="absolute left-0 top-full z-10 hidden group-hover:block min-w-[220px] pt-1">
              <div className="rounded-md border border-border bg-white shadow-md">
                {lists.map((list) => (
                  <div
                    key={`${list.workspaceId}-${list.listId}`}
                    className="flex items-center justify-between px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-muted">{list.workspaceName}:</span>
                      <span className="truncate">{list.listTitle}</span>
                    </span>
                    <button
                      onClick={(e) =>
                        handleRemoveList(list.workspaceId, list.listId, e)
                      }
                      className="ml-2 shrink-0 text-muted hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="border-t border-border">
                  <button
                    onClick={onToggleAddList}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50"
                  >
                    + Add list
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Workspace management dropdown */}
        {workspaces.length > 0 && (
          <div className="relative group">
            <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 transition-colors">
              {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
            </button>
            <div className="absolute right-0 top-full z-10 hidden group-hover:block min-w-[180px] pt-1"><div className="rounded-md border border-border bg-white shadow-md">
              {workspaces.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                >
                  <span>{w.name}</span>
                  <button
                    onClick={() => onDisconnect(w.id)}
                    className="text-muted hover:text-red-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
              <div className="border-t border-border">
                <button
                  onClick={onConnect}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50"
                >
                  + Add workspace
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {lists.length === 0 && (
          <button
            onClick={onToggleAddList}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
          >
            + Add List
          </button>
        )}

        {workspaces.length === 0 && (
          <button
            onClick={onConnect}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
          >
            + Connect
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
