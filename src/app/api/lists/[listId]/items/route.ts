import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getWorkspace } from "@/lib/store";
import { createListItem } from "@/lib/slack";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;
  const body = await request.json();
  const { workspaceId, fields, cells } = body;

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
    const token = workspace.userToken || workspace.botToken;
    const data = await createListItem(token, listId, fields || {}, cells);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Create item error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
