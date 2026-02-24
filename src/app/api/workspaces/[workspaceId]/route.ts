import { NextRequest, NextResponse } from "next/server";
import { removeWorkspace } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  removeWorkspace(workspaceId);
  return NextResponse.json({ ok: true });
}
