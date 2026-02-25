import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { getListItemInfo, getListItems } from "@/lib/slack";

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
    if (mode === "list") {
      const data = await getListItems(token, listId);
      // Return just the keys to understand structure
      return NextResponse.json({
        topLevelKeys: Object.keys(data),
        hasSchema: !!data.schema,
        schemaKeys: data.schema ? Object.keys(data.schema) : null,
        hasColumns: !!data.columns,
        columnsType: data.columns ? typeof data.columns : null,
        firstItem: data.items?.[0] ? Object.keys(data.items[0]) : null,
        firstItemFields: data.items?.[0]?.fields?.[0],
      });
    }

    if (!itemId) {
      return NextResponse.json({ error: "need itemId for item mode" });
    }
    const data = await getListItemInfo(token, listId, itemId);
    return NextResponse.json({
      topLevelKeys: Object.keys(data),
      schema: data.schema,
      columns: data.columns,
      item: data.item ? Object.keys(data.item) : null,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
