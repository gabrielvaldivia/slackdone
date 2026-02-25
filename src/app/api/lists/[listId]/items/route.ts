import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { createListItem } from "@/lib/slack";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
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
    const data = await createListItem(workspace.userToken || workspace.botToken, listId, fields);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Create item error:", err);
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }
}
