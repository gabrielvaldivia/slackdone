"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useRef, useEffect } from "react";
import TurndownService from "turndown";
import { marked } from "marked";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

// Preserve bare URLs: [url](url) → url
turndown.addRule("bareLink", {
  filter: (node) =>
    node.nodeName === "A" &&
    node.getAttribute("href") === node.textContent,
  replacement: (_content, node) =>
    (node as HTMLAnchorElement).getAttribute("href") || _content,
});

// Convert markdown→HTML for tiptap, preserving bare URLs as text
function markdownToHtml(md: string): string {
  const html = marked.parse(md) as string;
  // Undo marked's auto-linking: <a href="URL">URL</a> → URL (when text === href)
  return html.replace(/<a href="([^"]+)">\1<\/a>/g, "$1");
}

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
      Link.configure({ openOnClick: true, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialValue ? markdownToHtml(initialValue) : "",
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
