import { NextResponse } from "next/server";
import { getWorkspaces } from "@/lib/store";

export async function GET() {
  const configured = !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
  const all = await getWorkspaces();
  const workspaces = all.map(({ id, name }) => ({ id, name }));
  return NextResponse.json({ configured, workspaces });
}
