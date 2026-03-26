import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import {
  getLegacyWorkspaces,
  getLegacySavedLists,
  addWorkspace,
  addSavedList,
} from "@/lib/store";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const legacyWorkspaces = await getLegacyWorkspaces();
    let workspaceCount = 0;
    let listCount = 0;

    for (const ws of legacyWorkspaces) {
      await addWorkspace(session.userId, ws);
      workspaceCount++;

      const savedLists = await getLegacySavedLists(ws.id);
      for (const list of savedLists) {
        await addSavedList(session.userId, ws.id, list);
        listCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      migrated: { workspaces: workspaceCount, savedLists: listCount },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Migration error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
