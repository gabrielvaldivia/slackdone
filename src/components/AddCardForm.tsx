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
        className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />
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
          onClick={() => {
            setIsOpen(false);
            setTitle("");
          }}
          className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
