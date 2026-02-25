import { NextResponse } from "next/server";
import { getWorkspaces } from "@/lib/store";

export async function GET() {
  const configured = !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
  const workspaces = getWorkspaces().map(({ id, name }) => ({ id, name }));
  return NextResponse.json({ configured, workspaces });
}
