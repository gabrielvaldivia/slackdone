import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import { getApiKey, setApiKey, deleteApiKey } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = await getApiKey(session.userId);
  return NextResponse.json({ apiKey });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = crypto.randomUUID();
  await setApiKey(session.userId, key);
  return NextResponse.json({ apiKey: key });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteApiKey(session.userId);
  return NextResponse.json({ ok: true });
}
