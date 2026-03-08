import { NextRequest } from "next/server";
import { getUserIdByApiKey } from "./store";

export interface Session {
  userId: string;
  name: string;
  avatar: string;
  exp: number;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.length !== bBuf.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aBuf.length; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}

const COOKIE_NAME = "session";
const TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not configured");
  return secret;
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64url(sig);
}

export async function sign(payload: object, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const data = base64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmacSign(data, secret);
  return `${data}.${sig}`;
}

export async function verify(token: string, secret: string): Promise<object | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = await hmacSign(data, secret);
  // Timing-safe comparison to prevent timing attacks
  const sigBytes = fromBase64url(sig);
  const expectedBytes = fromBase64url(expected);
  if (sigBytes.length !== expectedBytes.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sigBytes.length; i++) {
    mismatch |= sigBytes[i] ^ expectedBytes[i];
  }
  if (mismatch !== 0) return null;
  try {
    const decoded = new TextDecoder().decode(fromBase64url(data));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function createSession(user: {
  userId: string;
  name: string;
  avatar: string;
}): Promise<string> {
  const payload: Session = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + TTL,
  };
  return sign(payload, getSecret());
}

export async function getSession(cookieValue: string): Promise<Session | null> {
  const payload = await verify(cookieValue, getSecret());
  if (!payload) return null;
  const session = payload as Session;
  if (!session.userId || !session.exp) return null;
  if (session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<Session | null> {
  // API key auth for machine-to-machine access
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    // Env-var fallback (backwards compat)
    const envKey = process.env.SLACKDONE_API_KEY;
    if (envKey && timingSafeEqual(apiKey, envKey)) {
      const userId = process.env.SLACKDONE_USER_ID;
      if (userId) {
        return { userId, name: "API", avatar: "", exp: Math.floor(Date.now() / 1000) + 86400 };
      }
    }
    // Firestore lookup for self-serve keys
    const userId = await getUserIdByApiKey(apiKey);
    if (userId) {
      return { userId, name: "API", avatar: "", exp: Math.floor(Date.now() / 1000) + 86400 };
    }
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return getSession(cookie.value);
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL,
  };
}
