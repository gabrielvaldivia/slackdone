import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { oauthAccess, getTeamInfo } from "@/lib/slack";
import { addWorkspace } from "@/lib/store";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${baseUrl}?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}?error=no_code`);
  }

  try {
    const oauthData = await oauthAccess(code);
    const botToken = oauthData.access_token;
    const userToken = oauthData.authed_user?.access_token;
    const team = await getTeamInfo(botToken);

    await addWorkspace(session.userId, {
      id: team.id,
      name: team.name,
      botToken,
      userToken,
    });

    const state = request.nextUrl.searchParams.get("state");
    if (state === "desktop") {
      return NextResponse.redirect(`${baseUrl}/auth/desktop?action=complete`);
    }
    return NextResponse.redirect(`${baseUrl}?workspace=${team.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("OAuth callback error:", msg);
    return NextResponse.redirect(
      `${baseUrl}?error=${encodeURIComponent(msg)}`
    );
  }
}
