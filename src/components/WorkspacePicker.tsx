"use client";

interface WorkspacePickerProps {
  workspaces: { id: string; name: string }[];
  selected: string;
  onChange: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export default function WorkspacePicker({
  workspaces,
  selected,
  onChange,
  onDisconnect,
}: WorkspacePickerProps) {
  if (workspaces.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border bg-transparent px-2 py-1 text-sm outline-none"
      >
        <option value="">Select workspace</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {selected && (
        <button
          onClick={() => onDisconnect(selected)}
          className="text-xs text-muted hover:text-foreground transition-colors"
          title="Disconnect workspace"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
