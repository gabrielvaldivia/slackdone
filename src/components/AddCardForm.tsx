"use client";

import { useState } from "react";

interface AddCardFormProps {
  onAdd: (title: string) => void;
}

export default function AddCardForm({ onAdd }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-1 text-xs text-muted hover:text-foreground transition-colors text-left"
      >
        + Add item
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || submitting) return;
        setSubmitting(true);
        try {
          await onAdd(title.trim());
          setTitle("");
          setIsOpen(false);
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
        className="w-full border border-border bg-transparent px-2 py-1 text-sm outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="border border-foreground bg-foreground px-2 py-1 text-xs text-background hover:bg-transparent hover:text-foreground transition-colors disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setTitle("");
          }}
          className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
