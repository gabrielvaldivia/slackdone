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

export async function searchLists(token: string) {
  const url = new URL(`${SLACK_API}/search.messages`);
  url.searchParams.set("query", "type:list");
  url.searchParams.set("count", "50");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API search.messages: ${data.error}`);
  }
  const messages = data.messages?.matches || [];
  const listsMap = new Map<string, { id: string; title: string }>();
  for (const msg of messages) {
    if (msg.list_id) {
      listsMap.set(msg.list_id, {
        id: msg.list_id,
        title: msg.text || msg.list_id,
      });
    }
  }
  return Array.from(listsMap.values());
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
    item_id: itemId,
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
  fields: Record<string, unknown>
) {
  const data = await slackFetch("slackLists.items.update", token, {
    list_id: listId,
    item_id: itemId,
    item: { fields },
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
