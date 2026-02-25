import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { getListItemInfo, getListItems, downloadList } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const listId = request.nextUrl.searchParams.get("listId");
  const itemId = request.nextUrl.searchParams.get("itemId");
  const mode = request.nextUrl.searchParams.get("mode") || "item";

  if (!workspaceId || !listId) {
    return NextResponse.json({ error: "need workspaceId, listId" });
  }

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" });
  }

  const token = workspace.userToken || workspace.botToken;

  try {
    if (mode === "download") {
      const data = await downloadList(token, listId);
      return NextResponse.json(data);
    }

    if (mode === "list") {
      const data = await getListItems(token, listId);
      return NextResponse.json({
        topLevelKeys: Object.keys(data),
        hasSchema: !!data.schema,
        firstItem: data.items?.[0],
      });
    }

    if (!itemId) {
      return NextResponse.json({ error: "need itemId for item mode" });
    }
    const data = await getListItemInfo(token, listId, itemId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
