import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getSavedViews, updateSavedViews } from "@/lib/store";
import { SavedView } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const views = await getSavedViews(session.userId);
  return NextResponse.json(views);
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const views = (await request.json()) as SavedView[];
  await updateSavedViews(session.userId, views);
  return NextResponse.json({ ok: true });
}
