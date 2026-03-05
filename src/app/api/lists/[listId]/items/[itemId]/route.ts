import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getWorkspace } from "@/lib/store";
import { updateListItem, deleteListItem } from "@/lib/slack";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, itemId } = await params;
  const body = await request.json();
  const { workspaceId, cells } = body;

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const workspace = await getWorkspace(session.userId, workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  // Normalize cells: accept either an array (Slack native format) or a
  // plain object like {"column_id": value} for convenience.
  let normalizedCells: Array<Record<string, unknown>>;
  if (Array.isArray(cells)) {
    normalizedCells = cells;
  } else if (cells && typeof cells === "object") {
    normalizedCells = Object.entries(cells).map(([key, value]) => {
      const cell: Record<string, unknown> = { column_id: key };
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        // Object wrapper: pass known type keys through directly
        // e.g. {"user": ["U07..."]} or {"select": ["Opt..."]}
        const obj = value as Record<string, unknown>;
        for (const k of ["user", "select", "date", "number", "value", "rich_text"]) {
          if (k in obj) {
            cell[k] = obj[k];
          }
        }
      } else if (Array.isArray(value)) {
        cell.select = value;
      } else if (typeof value === "number") {
        cell.number = value;
      } else {
        cell.value = String(value);
      }
      return cell;
    });
  } else {
    return NextResponse.json(
      { error: "cells must be an object or array" },
      { status: 400 }
    );
  }

  try {
    const data = await updateListItem(
      workspace.userToken || workspace.botToken,
      listId,
      itemId,
      normalizedCells
    );
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Update item error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, itemId } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const workspace = await getWorkspace(session.userId, workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  try {
    const data = await deleteListItem(
      workspace.userToken || workspace.botToken,
      listId,
      itemId
    );
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Delete item error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
