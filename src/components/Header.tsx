"use client";

import WorkspacePicker from "./WorkspacePicker";
import ListPicker from "./ListPicker";

interface HeaderProps {
  workspaces: { id: string; name: string }[];
  selectedWorkspace: string;
  selectedList: string;
  onWorkspaceChange: (id: string) => void;
  onListChange: (id: string) => void;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
}

export default function Header({
  workspaces,
  selectedWorkspace,
  selectedList,
  onWorkspaceChange,
  onListChange,
  onConnect,
  onDisconnect,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-semibold tracking-tight">Slackdone</h1>

        <WorkspacePicker
          workspaces={workspaces}
          selected={selectedWorkspace}
          onChange={onWorkspaceChange}
          onDisconnect={onDisconnect}
        />

        <ListPicker
          workspaceId={selectedWorkspace}
          selected={selectedList}
          onChange={onListChange}
        />
      </div>

      <button
        onClick={onConnect}
        className="border border-border px-3 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
      >
        + Connect
      </button>
    </header>
  );
}
