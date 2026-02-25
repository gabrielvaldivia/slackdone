import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { getListItems, getListItemInfo } from "@/lib/slack";
import { BoardColumn, BoardItem } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  try {
    const token = workspace.userToken || workspace.botToken;
    const data = await getListItems(token, listId);
    const items = data.items || [];

    // Get schema from items.info (returns list.list_metadata.schema)
    let listTitle = listId;
    let statusColumnId: string | null = null;
    let statusColumnKey: string | null = null;
    const optionsMap = new Map<string, string>(); // value -> label

    if (items.length > 0) {
      try {
        const info = await getListItemInfo(token, listId, items[0].id);
        listTitle = info.list?.title || listId;
        const schema = info.list?.list_metadata?.schema || [];

        for (const col of schema) {
          if (
            (col.type === "select" || col.type === "status") &&
            !statusColumnId
          ) {
            statusColumnId = col.id;
            statusColumnKey = col.key;
            const choices = col.options?.choices || [];
            for (const choice of choices) {
              optionsMap.set(choice.value, choice.label || choice.value);
            }
          }
        }
      } catch {
        // Fall through to inference
      }
    }

    // Build board columns from schema options
    const boardColumns: BoardColumn[] = [
      { id: "__none__", name: "No Status", items: [] },
    ];
    for (const [optId, optLabel] of optionsMap) {
      boardColumns.push({ id: optId, name: optLabel, items: [] });
    }

    // If no schema found, infer from item data
    if (!statusColumnId) {
      for (const item of items) {
        const fields = Array.isArray(item.fields) ? item.fields : [];
        for (const field of fields) {
          if (
            field.select &&
            Array.isArray(field.select) &&
            field.key !== "name"
          ) {
            statusColumnId = field.column_id || field.key;
            statusColumnKey = field.key;
            break;
          }
        }
        if (statusColumnId) break;
      }
      if (statusColumnId) {
        for (const item of items) {
          const fields = Array.isArray(item.fields) ? item.fields : [];
          for (const field of fields) {
            const colId = field.column_id || field.key;
            if (colId === statusColumnId && field.select) {
              for (const optId of field.select) {
                if (!optionsMap.has(optId)) {
                  optionsMap.set(optId, optId);
                  boardColumns.push({ id: optId, name: optId, items: [] });
                }
              }
            }
          }
        }
      }
    }

    // Sort items into columns
    for (const item of items) {
      const fields = Array.isArray(item.fields) ? item.fields : [];

      // Extract title from "name" field
      let title = "Untitled";
      for (const field of fields) {
        if (field.key === "name") {
          title = field.text || extractTextFromField(field) || "Untitled";
          break;
        }
      }

      // Extract status value
      let statusValue = "__none__";
      if (statusColumnId) {
        for (const field of fields) {
          // Match by column_id or key
          const matchesById = field.column_id === statusColumnId;
          const matchesByKey = field.key === statusColumnKey;
          if ((matchesById || matchesByKey) && field.select?.length > 0) {
            statusValue = field.select[0];
            break;
          }
        }
      }

      const boardItem: BoardItem = {
        id: item.id,
        title,
        statusValue,
        rawItem: {
          id: item.id,
          title,
          columnValues: fields,
        },
      };

      const col = boardColumns.find((c) => c.id === statusValue);
      if (col) {
        col.items.push(boardItem);
      } else {
        boardColumns[0].items.push(boardItem);
      }
    }

    return NextResponse.json({
      listId,
      listTitle,
      statusColumn: statusColumnId
        ? {
            id: statusColumnId,
            key: statusColumnKey,
            name: "Status",
            type: "select",
            options: Array.from(optionsMap.entries()).map(([id, name]) => ({
              id,
              name,
            })),
          }
        : null,
      columns: boardColumns,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Get list items error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function extractTextFromField(field: Record<string, unknown>): string {
  if (typeof field.text === "string") return field.text;
  if (typeof field.value === "string") {
    try {
      const parsed = JSON.parse(field.value);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((block: Record<string, unknown>) =>
            Array.isArray(block.elements)
              ? (block.elements as Record<string, unknown>[]).flatMap(
                  (section: Record<string, unknown>) =>
                    Array.isArray(section.elements)
                      ? (
                          section.elements as Record<string, unknown>[]
                        ).map((el: Record<string, unknown>) =>
                          (el.text as string) || ""
                        )
                      : []
                )
              : []
          )
          .join("");
      }
    } catch {
      return field.value;
    }
  }
  return "";
}
