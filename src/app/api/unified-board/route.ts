import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import { fetchUnifiedBoard } from "@/lib/board";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchUnifiedBoard(session.userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Unified board error:", err);
    return NextResponse.json(
      { error: "Failed to load unified board" },
      { status: 500 }
    );
  }
}
