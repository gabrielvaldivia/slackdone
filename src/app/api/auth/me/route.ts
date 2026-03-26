import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      userId: session.userId,
      name: session.name,
      avatar: session.avatar,
    },
  });
}
