const SLACK_API = "https://slack.com/api";

async function slackFetch(
  method: string,
  token: string,
  body?: Record<string, unknown>
) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API ${method}: ${data.error}`);
  }
  return data;
}

export async function getTeamInfo(token: string) {
  const data = await slackFetch("team.info", token);
  return { id: data.team.id, name: data.team.name };
}

export async function getListItems(token: string, listId: string) {
  const data = await slackFetch("slackLists.items.list", token, {
    list_id: listId,
    limit: 200,
  });
  return data;
}

export async function getListItemInfo(
  token: string,
  listId: string,
  itemId: string
) {
  const data = await slackFetch("slackLists.items.info", token, {
    list_id: listId,
    id: itemId,
  });
  return data;
}

export async function createListItem(
  token: string,
  listId: string,
  fields: Record<string, unknown>
) {
  const data = await slackFetch("slackLists.items.create", token, {
    list_id: listId,
    item: { fields },
  });
  return data;
}

export async function updateListItem(
  token: string,
  listId: string,
  itemId: string,
  cells: Array<Record<string, unknown>>
) {
  const data = await slackFetch("slackLists.items.update", token, {
    list_id: listId,
    cells: cells.map((cell) => ({ ...cell, row_id: itemId })),
  });
  return data;
}

export async function downloadList(token: string, listId: string) {
  // Start the download
  const start = await slackFetch("slackLists.download.start", token, {
    list_id: listId,
  });
  const downloadId = start.download_id;
  if (!downloadId) return start;

  // Poll for completion (up to 5 attempts)
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const result = await slackFetch("slackLists.download.get", token, {
      list_id: listId,
      download_id: downloadId,
    });
    if (result.status === "complete" || result.data) {
      return result;
    }
  }
  return null;
}

// In-memory user profile cache with 5-minute TTL
const USER_CACHE_TTL = 5 * 60 * 1000;
const userCache = new Map<string, { profile: { id: string; name: string; displayName: string; avatar: string }; ts: number }>();

export async function getUsersInfo(
  token: string,
  userIds: string[]
): Promise<Map<string, { id: string; name: string; displayName: string; avatar: string }>> {
  const result = new Map<string, { id: string; name: string; displayName: string; avatar: string }>();
  const now = Date.now();
  const toFetch = userIds.filter((id) => {
    const cached = userCache.get(id);
    if (cached && now - cached.ts < USER_CACHE_TTL) {
      result.set(id, cached.profile);
      return false;
    }
    return true;
  });

  await Promise.all(
    toFetch.map(async (userId) => {
      try {
        const res = await fetch(`${SLACK_API}/users.info?user=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        const user = data.user;
        const profile = {
          id: userId,
          name: user?.real_name || user?.name || userId,
          displayName: user?.profile?.display_name || user?.real_name || user?.name || userId,
          avatar: user?.profile?.image_48 || user?.profile?.image_32 || "",
        };
        userCache.set(userId, { profile, ts: now });
        result.set(userId, profile);
      } catch {
        const fallback = { id: userId, name: userId, displayName: userId, avatar: "" };
        result.set(userId, fallback);
      }
    })
  );

  return result;
}

export async function deleteListItem(
  token: string,
  listId: string,
  itemId: string
) {
  const data = await slackFetch("slackLists.items.delete", token, {
    list_id: listId,
    id: itemId,
  });
  return data;
}

export async function oauthAccess(code: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${baseUrl}/api/auth/callback`,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`OAuth error: ${data.error}`);
  }
  return data;
}
