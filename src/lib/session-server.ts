import { NextRequest } from "next/server";
import { getSessionFromRequest, Session } from "./session";
import { getUserIdByApiKey } from "./store";

/**
 * Extended session resolver for Node.js route handlers.
 * Adds Firestore-based API key lookup on top of the Edge-compatible session check.
 */
export async function getSessionFromRequestWithApiKey(
  request: NextRequest
): Promise<Session | null> {
  // Try the Edge-compatible session check first (cookie + env-var API key)
  const session = await getSessionFromRequest(request);
  if (session) return session;

  // Firestore-based API key lookup (Node.js only)
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const userId = await getUserIdByApiKey(apiKey);
    if (userId) {
      return { userId, name: "API", avatar: "", exp: Math.floor(Date.now() / 1000) + 86400 };
    }
  }

  return null;
}
