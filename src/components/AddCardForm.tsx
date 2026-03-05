"use client";

import { useState } from "react";
import { FilterOption } from "./FilterDropdown";
import FloatingDropdown from "./FloatingDropdown";

interface AddCardFormProps {
  onAdd: (title: string, assigneeIds: string[], clientId: string | null) => void;
  assigneeOptions?: FilterOption[];
  clientOptions?: FilterOption[];
  defaultAssignees?: Set<string>;
  defaultClient?: string | null;
  autoOpen?: boolean;
  onCancel?: () => void;
}

export default function AddCardForm({ onAdd, assigneeOptions = [], clientOptions = [], defaultAssignees, defaultClient, autoOpen, onCancel }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(autoOpen ?? false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(
    autoOpen && defaultAssignees ? new Set(defaultAssignees) : new Set()
  );
  const [selectedClient, setSelectedClient] = useState<string | null>(
    autoOpen && defaultClient ? defaultClient : null
  );
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const open = () => {
    setSelectedAssignees(defaultAssignees ? new Set(defaultAssignees) : new Set());
    setSelectedClient(defaultClient ?? null);
    setIsOpen(true);
  };

  const reset = () => {
    setTitle("");
    setSelectedAssignees(new Set());
    setSelectedClient(null);
    setIsOpen(false);
    setAssigneeDropdownOpen(false);
    setClientDropdownOpen(false);
    onCancel?.();
  };

  if (!isOpen) {
    if (autoOpen) return null;
    return (
      <button
        onClick={open}
        className="w-full py-1 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
      >
        + Add item
      </button>
    );
  }

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || submitting) return;
        setSubmitting(true);
        try {
          await onAdd(title.trim(), [...selectedAssignees], selectedClient);
          reset();
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-2"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title"
        autoFocus
        className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />

      {(assigneeOptions.length > 0 || clientOptions.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          {assigneeOptions.length > 0 && (
            <FloatingDropdown
              open={assigneeDropdownOpen}
              onOpenChange={setAssigneeDropdownOpen}
              trigger={
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                    selectedAssignees.size > 0
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {selectedAssignees.size > 0 ? (
                    <span className="flex items-center gap-1">
                      {[...selectedAssignees].slice(0, 2).map((id) => {
                        const opt = assigneeOptions.find((o) => o.id === id);
                        return opt?.avatar ? (
                          <img key={id} src={opt.avatar} alt="" className="h-4 w-4 rounded-full" />
                        ) : (
                          <span key={id} className="h-4 w-4 rounded-full bg-gray-300 inline-flex items-center justify-center text-[8px] text-white">
                            {opt?.name?.[0]}
                          </span>
                        );
                      })}
                      {selectedAssignees.size > 2 && <span>+{selectedAssignees.size - 2}</span>}
                    </span>
                  ) : (
                    "Assignee"
                  )}
                  <svg width="8" height="8" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              }
            >
              {assigneeOptions.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedAssignees.has(opt.id)}
                    onChange={() => toggleAssignee(opt.id)}
                    className="h-3 w-3 rounded border-gray-300 text-blue-600"
                  />
                  {opt.avatar ? (
                    <img src={opt.avatar} alt="" className="h-4 w-4 rounded-full" />
                  ) : (
                    <span className="h-4 w-4 rounded-full bg-gray-300 inline-flex items-center justify-center text-[8px] text-white">
                      {opt.name[0]}
                    </span>
                  )}
                  <span className="truncate">{opt.name}</span>
                </label>
              ))}
            </FloatingDropdown>
          )}

          {clientOptions.length > 0 && (
            <FloatingDropdown
              open={clientDropdownOpen}
              onOpenChange={setClientDropdownOpen}
              trigger={
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                    selectedClient
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {selectedClient ? (
                    <span className="flex items-center gap-1">
                      {(() => {
                        const opt = clientOptions.find((o) => o.id === selectedClient);
                        return opt?.badgeColor ? (
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.badgeColor.bg }} />
                        ) : null;
                      })()}
                      <span className="truncate max-w-[80px]">
                        {clientOptions.find((o) => o.id === selectedClient)?.name}
                      </span>
                    </span>
                  ) : (
                    "Client"
                  )}
                  <svg width="8" height="8" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              }
            >
              {selectedClient && (
                <button
                  type="button"
                  onClick={() => { setSelectedClient(null); setClientDropdownOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
              {clientOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setSelectedClient(opt.id); setClientDropdownOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${
                    selectedClient === opt.id ? "bg-blue-50" : ""
                  }`}
                >
                  {opt.badgeColor ? (
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: opt.badgeColor.bg }} />
                  ) : (
                    <span className="inline-block h-3 w-3 rounded-full bg-gray-300" />
                  )}
                  <span className="truncate">{opt.name}</span>
                </button>
              ))}
            </FloatingDropdown>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-foreground px-3 py-1 text-xs text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
