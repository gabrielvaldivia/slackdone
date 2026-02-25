import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { getListItemInfo } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const listId = request.nextUrl.searchParams.get("listId");
  const itemId = request.nextUrl.searchParams.get("itemId");

  if (!workspaceId || !listId || !itemId) {
    return NextResponse.json({ error: "need workspaceId, listId, itemId" });
  }

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" });
  }

  const token = workspace.userToken || workspace.botToken;
  const data = await getListItemInfo(token, listId, itemId);
  return NextResponse.json(data);
}
