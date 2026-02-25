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

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  try {
    const token = workspace.userToken || workspace.botToken;
    const lists = await searchLists(token);
    return NextResponse.json({ lists });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Search lists error:", msg);
    return NextResponse.json(
      { error: msg, hasUserToken: !!workspace.userToken },
      { status: 500 }
    );
  }
}
