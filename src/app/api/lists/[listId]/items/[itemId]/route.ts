import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { updateListItem } from "@/lib/slack";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { listId, itemId } = await params;
  const body = await request.json();
  const { workspaceId, fields } = body;

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
      fields
    );
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Update item error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
