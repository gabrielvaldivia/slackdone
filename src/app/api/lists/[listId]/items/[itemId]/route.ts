import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import { getWorkspace, getShareToken, setCompletedAt, clearCompletedAt } from "@/lib/store";
import { updateListItem, deleteListItem } from "@/lib/slack";
import { Workspace } from "@/lib/types";

// Resolve auth from session or share token, returning { userId, workspace }
async function resolveAuth(
  request: NextRequest,
  workspaceId: string,
  shareToken?: string
): Promise<{ userId: string; workspace: Workspace } | NextResponse> {
  // Try share token first (for shared editable boards)
  if (shareToken) {
    const share = await getShareToken(shareToken);
    if (!share || share.mode !== "edit") {
      return NextResponse.json({ error: "Invalid or read-only share link" }, { status: 403 });
    }
    const workspace = await getWorkspace(share.userId, workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return { userId: share.userId, workspace };
  }

  // Fall back to session auth
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspace = await getWorkspace(session.userId, workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return { userId: session.userId, workspace };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { listId, itemId } = await params;
  const body = await request.json();
  const { workspaceId, cells, shareToken } = body;

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const auth = await resolveAuth(request, workspaceId, shareToken);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspace } = auth;

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
        const obj = value as Record<string, unknown>;
        for (const k of ["user", "select", "date", "number", "rich_text", "link", "checkbox", "rating", "channel"]) {
          if (k in obj) {
            cell[k] = obj[k];
          }
        }
      } else if (Array.isArray(value)) {
        cell.select = value;
      } else if (typeof value === "number") {
        cell.number = value;
      } else {
        cell.rich_text = [
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_section",
                elements: [{ type: "text", text: String(value) }],
              },
            ],
          },
        ];
      }
      return cell;
    });
  } else {
    return NextResponse.json(
      { error: "cells must be an object or array" },
      { status: 400 }
    );
  }

  const statusLabel = body.statusLabel as string | undefined;

  // Link-type columns silently fail with bot tokens — require user token
  const hasLinkCell = normalizedCells.some((c) => "link" in c);
  if (hasLinkCell && !workspace.userToken) {
    return NextResponse.json(
      { error: "Link columns require a user token. Please re-authorize this workspace.", code: "USER_TOKEN_REQUIRED" },
      { status: 403 }
    );
  }

  // Use user token for link writes (bot tokens silently drop link data)
  const token = hasLinkCell
    ? workspace.userToken!
    : workspace.userToken || workspace.botToken;

  try {
    const data = await updateListItem(
      token,
      listId,
      itemId,
      normalizedCells
    );

    if (statusLabel !== undefined) {
      const isDone = statusLabel.toLowerCase().trim() === "done";
      if (isDone) {
        await setCompletedAt(userId, itemId, new Date().toISOString());
      } else {
        await clearCompletedAt(userId, itemId);
      }
    }

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
  const { listId, itemId } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const shareToken = request.nextUrl.searchParams.get("shareToken");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const auth = await resolveAuth(request, workspaceId, shareToken || undefined);
  if (auth instanceof NextResponse) return auth;
  const { workspace } = auth;

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
