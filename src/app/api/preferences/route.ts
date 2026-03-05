import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getBoardPreferences, updateBoardPreferences, BoardPreferences } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await getBoardPreferences(session.userId);
  return NextResponse.json(prefs || {});
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as BoardPreferences;
  await updateBoardPreferences(session.userId, body);
  return NextResponse.json({ ok: true });
}
