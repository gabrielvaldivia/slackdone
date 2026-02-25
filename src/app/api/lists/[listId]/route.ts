import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { getListItems } from "@/lib/slack";
import { BoardColumn, BoardItem, SlackListColumn } from "@/lib/types";

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
    const schema = data.schema || {};

    // Find the status column (first column of type "select" or "status")
    let statusColumn: SlackListColumn | null = null;
    const columns: SlackListColumn[] = [];

    if (schema.columns) {
      for (const col of schema.columns) {
        const parsed: SlackListColumn = {
          id: col.id,
          name: col.name || col.id,
          type: col.type,
          options: col.options || [],
        };
        columns.push(parsed);
        if (
          !statusColumn &&
          (col.type === "select" || col.type === "status")
        ) {
          statusColumn = parsed;
        }
      }
    }

    // Build board columns from status options
    const boardColumns: BoardColumn[] = [];
    if (statusColumn?.options) {
      for (const opt of statusColumn.options) {
        boardColumns.push({ id: opt.id, name: opt.name, items: [] });
      }
    }
    // Add "No Status" column
    boardColumns.unshift({ id: "__none__", name: "No Status", items: [] });

    // Sort items into columns
    for (const item of items) {
      const fields = item.fields || {};
      const titleField = fields.title || fields.Title || "";
      const title =
        typeof titleField === "string"
          ? titleField
          : extractTextFromRichText(titleField);

      let statusValue = "__none__";
      if (statusColumn && fields[statusColumn.id]) {
        const val = fields[statusColumn.id];
        statusValue = typeof val === "string" ? val : val?.id || "__none__";
      }

      const boardItem: BoardItem = {
        id: item.id,
        title: title || "Untitled",
        statusValue,
        rawItem: {
          id: item.id,
          title: title || "Untitled",
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
      statusColumn,
      columns: boardColumns,
      allColumns: columns,
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

function extractTextFromRichText(field: unknown): string {
  if (typeof field === "string") return field;
  if (!field || typeof field !== "object") return "";
  const obj = field as Record<string, unknown>;
  // Block Kit rich text: { elements: [{ elements: [{ text: "..." }] }] }
  if (Array.isArray(obj.elements)) {
    return obj.elements
      .flatMap((block: Record<string, unknown>) =>
        Array.isArray(block.elements)
          ? block.elements.map((el: Record<string, unknown>) => el.text || "")
          : []
      )
      .join("");
  }
  if (typeof obj.text === "string") return obj.text;
  return JSON.stringify(field);
}
