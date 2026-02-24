import { NextRequest, NextResponse } from "next/server";
import { oauthAccess, getTeamInfo } from "@/lib/slack";
import { addWorkspace } from "@/lib/store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${baseUrl}?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}?error=no_code`);
  }

  try {
    const oauthData = await oauthAccess(code);
    const botToken = oauthData.access_token;
    const team = await getTeamInfo(botToken);

    addWorkspace({
      id: team.id,
      name: team.name,
      botToken,
    });

    return NextResponse.redirect(`${baseUrl}?workspace=${team.id}`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}?error=oauth_failed`);
  }
}
