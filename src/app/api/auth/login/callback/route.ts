import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";
import { ensureUser } from "@/lib/store";

const SLACK_API = "https://slack.com/api";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(error)}`
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }

  try {
    // Exchange code for token via openid.connect.token
    const tokenRes = await fetch(`${SLACK_API}/openid.connect.token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${baseUrl}/api/auth/login/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.ok) {
      throw new Error(tokenData.error || "Token exchange failed");
    }

    // Get user info
    const userRes = await fetch(`${SLACK_API}/openid.connect.userInfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    if (!userData.ok) {
      throw new Error(userData.error || "Failed to get user info");
    }

    const userId = userData.sub; // Slack user ID
    const name =
      userData.name || userData.real_name || userData.given_name || "User";
    const avatar = userData.picture || "";

    // Create user doc in Firestore
    await ensureUser({ id: userId, name, avatar });

    // Create session cookie
    const token = await createSession({ userId, name, avatar });
    const response = NextResponse.redirect(baseUrl);
    response.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Login callback error:", msg);
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(msg)}`
    );
  }
}
