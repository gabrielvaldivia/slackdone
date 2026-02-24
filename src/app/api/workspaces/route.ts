import { NextResponse } from "next/server";
import { getWorkspaces } from "@/lib/store";

export async function GET() {
  const workspaces = getWorkspaces().map(({ id, name }) => ({ id, name }));
  return NextResponse.json({ workspaces });
}
