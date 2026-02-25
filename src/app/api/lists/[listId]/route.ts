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

    // The API returns fields as an array of objects:
    // { key, value, text?, select?, rich_text?, column_id }
    // "key" = "name" is the title field
    // Fields with "select" arrays are status/select columns

    // First pass: discover the status column and its options
    let statusColumnId: string | null = null;
    const optionsMap = new Map<string, string>(); // optionId -> optionName

    // Look at schema columns if available
    const schemaColumns = data.schema?.columns || data.columns || [];
    for (const col of schemaColumns) {
      if (col.type === "select" || col.type === "status") {
        if (!statusColumnId) {
          statusColumnId = col.id;
          if (col.options) {
            for (const opt of col.options) {
              optionsMap.set(opt.id, opt.name || opt.label || opt.id);
            }
          }
        }
      }
    }

    // If no schema from list response, fetch item info to get column definitions
    if (!statusColumnId && items.length > 0) {
      try {
        const itemInfo = await getListItemInfo(token, listId, items[0].id);
        const infoCols = itemInfo.schema?.columns || itemInfo.columns || [];
        for (const col of infoCols) {
          if (col.type === "select" || col.type === "status") {
            if (!statusColumnId) {
              statusColumnId = col.id;
              if (col.options) {
                for (const opt of col.options) {
                  optionsMap.set(opt.id, opt.name || opt.label || opt.id);
                }
              }
            }
          }
        }
      } catch {
        // Fall through to inference
      }
    }

    // Last resort: infer from item data
    if (!statusColumnId) {
      for (const item of items) {
        const fields = Array.isArray(item.fields) ? item.fields : [];
        for (const field of fields) {
          if (field.select && Array.isArray(field.select) && field.key !== "name") {
            statusColumnId = field.column_id || field.key;
            break;
          }
        }
        if (statusColumnId) break;
      }

      // Collect all unique option IDs for this column
      if (statusColumnId) {
        for (const item of items) {
          const fields = Array.isArray(item.fields) ? item.fields : [];
          for (const field of fields) {
            const colId = field.column_id || field.key;
            if (colId === statusColumnId && field.select) {
              for (const optId of field.select) {
                if (!optionsMap.has(optId)) {
                  optionsMap.set(optId, optId);
                }
              }
            }
          }
        }
      }
    }

    // Build board columns
    const boardColumns: BoardColumn[] = [
      { id: "__none__", name: "No Status", items: [] },
    ];
    for (const [optId, optName] of optionsMap) {
      boardColumns.push({ id: optId, name: optName, items: [] });
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

      // Extract status
      let statusValue = "__none__";
      if (statusColumnId) {
        for (const field of fields) {
          const colId = field.column_id || field.key;
          if (colId === statusColumnId && field.select?.length > 0) {
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
      listTitle: data.list?.title || listId,
      statusColumn: statusColumnId
        ? { id: statusColumnId, name: "Status", type: "select", options: Array.from(optionsMap.entries()).map(([id, name]) => ({ id, name })) }
        : null,
      columns: boardColumns,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Get list items error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

function extractTextFromField(field: Record<string, unknown>): string {
  if (typeof field.text === "string") return field.text;
  if (typeof field.value === "string") {
    // Try parsing rich_text JSON
    try {
      const parsed = JSON.parse(field.value);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((block: Record<string, unknown>) =>
            Array.isArray(block.elements)
              ? (block.elements as Record<string, unknown>[]).flatMap((section: Record<string, unknown>) =>
                  Array.isArray(section.elements)
                    ? (section.elements as Record<string, unknown>[]).map((el: Record<string, unknown>) => (el.text as string) || "")
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
