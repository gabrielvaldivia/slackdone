import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { searchLists } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  try {
    const lists = await searchLists(workspace.botToken);
    return NextResponse.json({ lists });
  } catch (err) {
    console.error("Search lists error:", err);
    return NextResponse.json(
      { error: "Failed to search lists" },
      { status: 500 }
    );
  }
}
