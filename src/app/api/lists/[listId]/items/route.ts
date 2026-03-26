import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import { getWorkspace, getShareToken } from "@/lib/store";
import { createListItem } from "@/lib/slack";
import { Workspace } from "@/lib/types";

async function resolveAuth(
  request: NextRequest,
  workspaceId: string,
  shareToken?: string
): Promise<{ userId: string; workspace: Workspace } | NextResponse> {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const body = await request.json();
  const { workspaceId, initialFields, shareToken } = body;

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const auth = await resolveAuth(request, workspaceId, shareToken);
  if (auth instanceof NextResponse) return auth;
  const { workspace } = auth;

  try {
    const data = await createListItem(
      workspace.userToken || workspace.botToken,
      listId,
      initialFields || []
    );
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
