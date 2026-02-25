import { NextResponse } from "next/server";
import { getWorkspaces } from "@/lib/store";

export async function GET() {
  const configured = !!(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  );

  if (!configured) {
    return NextResponse.json({ configured: false, workspaces: [] });
  }

  try {
    const all = await getWorkspaces();
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
