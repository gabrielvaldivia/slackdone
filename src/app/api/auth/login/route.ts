import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "SLACK_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/login/callback`;

  const url = new URL("https://slack.com/openid/connect/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("nonce", crypto.randomUUID());

  return NextResponse.redirect(url.toString());
}
