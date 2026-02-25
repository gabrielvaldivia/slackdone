import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { updateListItem, deleteListItem } from "@/lib/slack";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { listId, itemId } = await params;
  const body = await request.json();
  const { workspaceId, cells } = body;

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
    const data = await updateListItem(
      workspace.userToken || workspace.botToken,
      listId,
      itemId,
      cells
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
  const { listId, itemId } = await params;
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
