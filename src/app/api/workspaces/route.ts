import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import { getWorkspaces } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = !!(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.FIREBASE_PROJECT_ID
  );

  if (!configured) {
    return NextResponse.json({ configured: false, workspaces: [] });
  }

  try {
    const all = await getWorkspaces(session.userId);
    const workspaces = all.map(({ id, name }) => ({ id, name }));
    return NextResponse.json({ configured, workspaces });
  } catch (err) {
    console.error("Workspaces fetch error:", err);
    return NextResponse.json({
      configured,
      workspaces: [],
      error: String(err),
    });
  }
}
