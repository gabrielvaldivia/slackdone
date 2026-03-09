"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useEffect } from "react";
import TurndownService from "turndown";
import { marked } from "marked";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

interface RichTextEditorProps {
  initialValue: string;
  onUpdate: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  initialValue,
  onUpdate,
  placeholder = "Empty",
}: RichTextEditorProps) {
  const lastSaved = useRef(initialValue);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: initialValue ? (marked.parse(initialValue) as string) : "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[80px] px-3 py-2 text-sm outline-none",
      },
    },
    onBlur({ editor }) {
      if (!mountedRef.current) return;

      const html = editor.getHTML();
      const markdown = turndown.turndown(html).trim();
      if (markdown !== lastSaved.current) {
        lastSaved.current = markdown;
        onUpdate(markdown);
      }
    },
  });

  if (!editor) {
    return (
      <div className="rounded-md border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground min-h-[80px]">
        {placeholder}
      </div>
    );
  }

  return (
    <div className="relative rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring">
      <EditorContent editor={editor} />
    </div>
  );
}
