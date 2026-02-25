import { NextRequest, NextResponse } from "next/server";
import { getSavedLists, addSavedList, removeSavedList } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  try {
    const lists = await getSavedLists(workspaceId);
    return NextResponse.json({ lists });
  } catch (err) {
    console.error("Get saved lists error:", err);
    return NextResponse.json({ error: "Failed to get saved lists" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const body = await request.json();
  const { listId, title } = body;

  if (!listId) {
    return NextResponse.json({ error: "listId required" }, { status: 400 });
  }

  try {
    await addSavedList(workspaceId, {
      listId,
      title: title || listId,
      workspaceId,
      addedAt: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Save list error:", err);
    return NextResponse.json({ error: "Failed to save list" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const { listId } = await request.json();

  if (!listId) {
    return NextResponse.json({ error: "listId required" }, { status: 400 });
  }

  try {
    await removeSavedList(workspaceId, listId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Remove saved list error:", err);
    return NextResponse.json({ error: "Failed to remove list" }, { status: 500 });
  }
}
