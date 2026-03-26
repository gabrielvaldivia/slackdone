import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestWithApiKey as getSessionFromRequest } from "@/lib/session-server";
import { removeWorkspace } from "@/lib/store";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  await removeWorkspace(session.userId, workspaceId);
  return NextResponse.json({ ok: true });
}
