import { NextRequest, NextResponse } from "next/server";
import { getShareToken } from "@/lib/store";
import { fetchUnifiedBoard } from "@/lib/board";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const share = await getShareToken(token);
    if (!share) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const board = await fetchUnifiedBoard(share.userId);

    return NextResponse.json({
      board,
      view: share.viewSnapshot,
      mode: share.mode || "readonly",
    });
  } catch (err) {
    console.error("Shared board error:", err);
    return NextResponse.json(
      { error: "Failed to load shared board" },
      { status: 500 }
    );
  }
}
