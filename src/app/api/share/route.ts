import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getSavedViews, getBoardPreferences, createShareToken } from "@/lib/store";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { viewId, mode = "readonly" } = await request.json();
    if (!viewId) {
      return NextResponse.json({ error: "viewId required" }, { status: 400 });
    }

    const views = await getSavedViews(session.userId);
    const view = views.find((v) => v.id === viewId);
    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    const prefs = await getBoardPreferences(session.userId);

    const token = crypto.randomUUID();
    await createShareToken(token, {
      userId: session.userId,
      viewId,
      viewSnapshot: {
        ...view,
        columnOrder: prefs?.columnOrder,
        minimizedColumns: prefs?.minimizedColumns,
      },
      mode: mode === "edit" ? "edit" : "readonly",
      createdAt: Date.now(),
    });

    return NextResponse.json({ token, url: `/share/${token}` });
  } catch (err) {
    console.error("Create share error:", err);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
