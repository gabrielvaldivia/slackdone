import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env.local"), quiet: true });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getWorkspaces, getWorkspace, getSavedLists, getCompletedAtMap, setCompletedAt, clearCompletedAt } from "./src/lib/store.js";
import {
  getListItems,
  getListItemInfo,
  createListItem,
  updateListItem,
  deleteListItem,
  getUsersInfo,
} from "./src/lib/slack.js";
import type { Workspace, SavedList, BoardColumn, BoardItem, BoardItemField, SchemaField, UserProfile } from "./src/lib/types.js";

const USER_ID = process.env.SLACKDONE_USER_ID;
if (!USER_ID) {
  console.error("SLACKDONE_USER_ID env var is required");
  process.exit(1);
}

const server = new McpServer({
  name: "slackdone",
  version: "1.0.0",
});

// ── Read tools ──────────────────────────────────────────────────────────

server.registerTool("list-workspaces", {
  title: "List Workspaces",
  description: "List all connected Slack workspaces for the current user",
  inputSchema: z.object({}),
}, async () => {
  const workspaces = await getWorkspaces(USER_ID);
  const result = workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("get-board", {
  title: "Get Board",
  description: "Get the unified board — all items across all saved lists, grouped by status column",
  inputSchema: z.object({}),
}, async () => {
  const allWorkspaces = await getWorkspaces(USER_ID);
  if (allWorkspaces.length === 0) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ columns: [], lists: [] }) }] };
  }

  const workspaceListPairs = await Promise.all(
    allWorkspaces.map(async (ws) => ({
      workspace: ws,
      savedLists: await getSavedLists(USER_ID, ws.id),
    }))
  );

  const fetchTasks: { workspace: Workspace; savedList: SavedList }[] = [];
  for (const { workspace, savedLists } of workspaceListPairs) {
    for (const sl of savedLists) {
      fetchTasks.push({ workspace, savedList: sl });
    }
  }

  if (fetchTasks.length === 0) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ columns: [], lists: [] }) }] };
  }

  const results = await Promise.all(
    fetchTasks.map(async ({ workspace, savedList }) => {
      try {
        return await fetchSingleBoard(workspace, savedList);
      } catch (err) {
        console.error(`Failed to fetch list ${savedList.listId}:`, err);
        return null;
      }
    })
  );

  // Merge columns by normalized name
  const mergedColumnMap = new Map<string, { name: string; items: BoardItem[] }>();
  const columnOrder: string[] = [];
  const allLists: ListMeta[] = [];

  for (const result of results) {
    if (!result) continue;
    allLists.push(result.meta);
    for (const col of result.columns) {
      const key = col.name.toLowerCase().trim();
      const existing = mergedColumnMap.get(key);
      if (existing) {
        existing.items.push(...col.items);
      } else {
        mergedColumnMap.set(key, { name: col.name, items: [...col.items] });
        columnOrder.push(key);
      }
    }
  }

  // Hydrate completedAt timestamps
  const completedAtMap = await getCompletedAtMap(USER_ID);
  for (const [, col] of mergedColumnMap) {
    for (const item of col.items) {
      item.completedAt = completedAtMap.get(item.id) ?? null;
    }
  }

  const noStatusKey = "no status";
  const orderedKeys = [noStatusKey, ...columnOrder.filter((k) => k !== noStatusKey)];
  const mergedColumns: { id: string; name: string; items: SimplifiedBoardItem[] }[] = [];

  for (const key of orderedKeys) {
    const col = mergedColumnMap.get(key);
    if (col) {
      mergedColumns.push({
        id: key,
        name: col.name,
        items: col.items.map(simplifyItem),
      });
    }
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        columns: mergedColumns,
        lists: allLists.map((m) => ({
          listId: m.listId,
          listTitle: m.listTitle,
          workspaceId: m.workspaceId,
          workspaceName: m.workspaceName,
        })),
      }, null, 2),
    }],
  };
});

server.registerTool("get-list-items", {
  title: "Get List Items",
  description: "Get all items from a specific Slack list",
  inputSchema: z.object({
    workspaceId: z.string().describe("Workspace ID"),
    listId: z.string().describe("Slack list ID"),
  }),
}, async ({ workspaceId, listId }) => {
  const workspace = await getWorkspace(USER_ID, workspaceId);
  if (!workspace) {
    return { content: [{ type: "text" as const, text: "Workspace not found" }], isError: true };
  }
  const token = workspace.userToken || workspace.botToken;
  const data = await getListItems(token, listId);
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
});

server.registerTool("get-item", {
  title: "Get Item",
  description: "Get full details of a specific list item",
  inputSchema: z.object({
    workspaceId: z.string().describe("Workspace ID"),
    listId: z.string().describe("Slack list ID"),
    itemId: z.string().describe("Item ID"),
  }),
}, async ({ workspaceId, listId, itemId }) => {
  const workspace = await getWorkspace(USER_ID, workspaceId);
  if (!workspace) {
    return { content: [{ type: "text" as const, text: "Workspace not found" }], isError: true };
  }
  const token = workspace.userToken || workspace.botToken;
  const data = await getListItemInfo(token, listId, itemId);
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
});

// ── Write tools ─────────────────────────────────────────────────────────

server.registerTool("create-item", {
  title: "Create Item",
  description: "Create a new item in a Slack list. The fields object should contain field keys mapped to their values.",
  inputSchema: z.object({
    workspaceId: z.string().describe("Workspace ID"),
    listId: z.string().describe("Slack list ID"),
    fields: z.record(z.string(), z.unknown()).describe("Fields for the new item (e.g. { name: 'Task title' })"),
  }),
}, async ({ workspaceId, listId, fields }) => {
  const workspace = await getWorkspace(USER_ID, workspaceId);
  if (!workspace) {
    return { content: [{ type: "text" as const, text: "Workspace not found" }], isError: true };
  }
  const token = workspace.userToken || workspace.botToken;
  const data = await createListItem(token, listId, fields);
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
});

server.registerTool("update-item", {
  title: "Update Item",
  description: "Update fields on an existing list item. Cells is an array of objects with column_id and value. Pass statusLabel when changing status to track completion.",
  inputSchema: z.object({
    workspaceId: z.string().describe("Workspace ID"),
    listId: z.string().describe("Slack list ID"),
    itemId: z.string().describe("Item ID"),
    cells: z.array(z.record(z.string(), z.unknown())).describe("Array of cell updates, each with column_id and value"),
    statusLabel: z.string().optional().describe("The display label of the target status column (e.g. 'Done', 'In Progress'). Used to track completion timestamps."),
  }),
}, async ({ workspaceId, listId, itemId, cells, statusLabel }) => {
  const workspace = await getWorkspace(USER_ID, workspaceId);
  if (!workspace) {
    return { content: [{ type: "text" as const, text: "Workspace not found" }], isError: true };
  }
  const token = workspace.userToken || workspace.botToken;
  const data = await updateListItem(token, listId, itemId, cells);

  // Track completedAt
  if (statusLabel !== undefined) {
    const isDone = statusLabel.toLowerCase().trim() === "done";
    if (isDone) {
      await setCompletedAt(USER_ID, itemId, new Date().toISOString());
    } else {
      await clearCompletedAt(USER_ID, itemId);
    }
  }

  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
});

server.registerTool("delete-item", {
  title: "Delete Item",
  description: "Delete an item from a Slack list",
  inputSchema: z.object({
    workspaceId: z.string().describe("Workspace ID"),
    listId: z.string().describe("Slack list ID"),
    itemId: z.string().describe("Item ID"),
  }),
}, async ({ workspaceId, listId, itemId }) => {
  const workspace = await getWorkspace(USER_ID, workspaceId);
  if (!workspace) {
    return { content: [{ type: "text" as const, text: "Workspace not found" }], isError: true };
  }
  const token = workspace.userToken || workspace.botToken;
  const data = await deleteListItem(token, listId, itemId);
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
});

// ── Board building helpers (extracted from unified-board route) ─────────

interface ListMeta {
  listId: string;
  listTitle: string;
  workspaceId: string;
  workspaceName: string;
  statusColumnId: string | null;
}

interface SimplifiedBoardItem {
  id: string;
  title: string;
  status: string;
  fields: { label: string; value: string }[];
  assignees: string[];
  workspaceName?: string;
  sourceWorkspaceId?: string;
  sourceListId?: string;
  completedAt?: string | null;
}

function simplifyItem(item: BoardItem): SimplifiedBoardItem {
  return {
    id: item.id,
    title: item.title,
    status: item.statusValue,
    fields: (item.fields || [])
      .filter((f) => f.displayValue)
      .map((f) => ({ label: f.label, value: f.displayValue })),
    assignees: (item.assignees || []).map((a) => a.displayName),
    workspaceName: item.workspaceName,
    sourceWorkspaceId: item.sourceWorkspaceId,
    sourceListId: item.sourceListId,
    completedAt: item.completedAt ?? null,
  };
}

async function fetchSingleBoard(
  workspace: Workspace,
  savedList: SavedList
): Promise<{ meta: ListMeta; columns: BoardColumn[]; schema: SchemaField[] }> {
  const token = workspace.userToken || workspace.botToken;
  const listId = savedList.listId;
  const data = await getListItems(token, listId);
  const items = data.items || [];

  let listTitle = savedList.title || listId;
  let statusColumnId: string | null = null;
  let statusColumnKey: string | null = null;
  const optionsMap = new Map<string, string>();
  const schemaFields: SchemaField[] = [];

  if (items.length > 0) {
    try {
      const info = await getListItemInfo(token, listId, items[0].id);
      listTitle = info.list?.title || listTitle;
      const schema = info.list?.list_metadata?.schema || [];

      for (const col of schema) {
        const field: SchemaField = {
          id: col.id,
          key: col.key,
          type: col.type,
          label: col.label || col.name || col.key,
          options: col.options?.choices?.map(
            (c: { value: string; label: string; color?: string }) => ({
              value: c.value,
              label: c.label || c.value,
              color: c.color,
            })
          ),
        };
        schemaFields.push(field);

        if ((col.type === "select" || col.type === "status") && !statusColumnId) {
          statusColumnId = col.id;
          statusColumnKey = col.key;
          const choices = col.options?.choices || [];
          for (const choice of choices) {
            optionsMap.set(choice.value, choice.label || choice.value);
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  const boardColumns: BoardColumn[] = [
    { id: "__none__", name: "No Status", items: [] },
  ];
  for (const [optId, optLabel] of optionsMap) {
    boardColumns.push({ id: optId, name: optLabel, items: [] });
  }

  // Infer status column if not found in schema
  if (!statusColumnId) {
    for (const item of items) {
      const fields = Array.isArray(item.fields) ? item.fields : [];
      for (const field of fields) {
        if (field.select && Array.isArray(field.select) && field.key !== "name") {
          statusColumnId = field.column_id || field.key;
          statusColumnKey = field.key;
          break;
        }
      }
      if (statusColumnId) break;
    }
    if (statusColumnId) {
      for (const item of items) {
        const fields = Array.isArray(item.fields) ? item.fields : [];
        for (const field of fields) {
          const colId = field.column_id || field.key;
          if (colId === statusColumnId && field.select) {
            for (const optId of field.select) {
              if (!optionsMap.has(optId)) {
                optionsMap.set(optId, optId);
                boardColumns.push({ id: optId, name: optId, items: [] });
              }
            }
          }
        }
      }
    }
  }

  const schemaByKey = new Map<string, SchemaField>();
  const schemaById = new Map<string, SchemaField>();
  for (const sf of schemaFields) {
    schemaByKey.set(sf.key, sf);
    schemaById.set(sf.id, sf);
  }

  // Collect user IDs
  const allUserIds = new Set<string>();
  for (const item of items) {
    const fields = Array.isArray(item.fields) ? item.fields : [];
    for (const field of fields) {
      const sf = schemaByKey.get(field.key) || schemaById.get(field.column_id);
      if (sf?.type === "people" || sf?.type === "user" || field.people || field.user) {
        const raw = field.people || field.user || field.value;
        const people = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
        for (const userId of people) {
          if (typeof userId === "string") allUserIds.add(userId);
        }
      }
    }
  }

  let userProfiles = new Map<string, { id: string; name: string; displayName: string; avatar: string }>();
  if (allUserIds.size > 0) {
    try {
      userProfiles = await getUsersInfo(workspace.botToken || token, Array.from(allUserIds));
    } catch {
      // Graceful fallback
    }
  }

  // Sort items into columns
  for (const item of items) {
    const fields = Array.isArray(item.fields) ? item.fields : [];

    let title = "Untitled";
    for (const field of fields) {
      if (field.key === "name") {
        title = field.text || extractTextFromField(field) || "Untitled";
        break;
      }
    }

    let statusValue = "__none__";
    if (statusColumnId) {
      for (const field of fields) {
        const matchesById = field.column_id === statusColumnId;
        const matchesByKey = field.key === statusColumnKey;
        if ((matchesById || matchesByKey) && field.select?.length > 0) {
          statusValue = field.select[0];
          break;
        }
      }
    }

    const parsedFields: BoardItemField[] = [];
    const itemAssignees: UserProfile[] = [];

    for (const field of fields) {
      if (field.key === "name") continue;

      const sf = schemaByKey.get(field.key) || schemaById.get(field.column_id);
      const fieldType = sf?.type || "unknown";
      const fieldLabel = sf?.label || field.key || "Unknown";
      const columnId = field.column_id || sf?.id || field.key;

      let displayValue = "";
      let rawValue: unknown = null;

      if (fieldType === "people" || fieldType === "user" || field.people || field.user) {
        const rawPeople = field.people || field.user || field.value;
        const people = Array.isArray(rawPeople) ? rawPeople : typeof rawPeople === "string" ? [rawPeople] : [];
        if (people.length > 0) {
          rawValue = people;
          const names: string[] = [];
          for (const userId of people) {
            if (typeof userId === "string") {
              const profile = userProfiles.get(userId);
              if (profile) {
                names.push(profile.displayName);
                itemAssignees.push(profile);
              } else {
                names.push(userId);
                itemAssignees.push({ id: userId, name: userId, displayName: userId, avatar: "" });
              }
            }
          }
          displayValue = names.join(", ");
        }
      } else if (fieldType === "select" || fieldType === "status" || field.select) {
        const selectIds = field.select || [];
        rawValue = selectIds;
        if (sf?.options) {
          const labels = selectIds.map((id: string) => {
            const opt = sf.options?.find((o) => o.value === id);
            return opt?.label || id;
          });
          displayValue = labels.join(", ");
        } else {
          displayValue = selectIds.join(", ");
        }
      } else if (fieldType === "date" || field.date) {
        rawValue = field.date || field.value;
        displayValue = typeof rawValue === "string" ? rawValue : "";
      } else if (field.text) {
        rawValue = field.text;
        displayValue = field.text;
      } else if (field.number !== undefined) {
        rawValue = field.number;
        displayValue = String(field.number);
      } else {
        rawValue = field.value;
        displayValue = extractTextFromField(field) || "";
      }

      parsedFields.push({
        columnId,
        key: field.key || sf?.key || "",
        type: fieldType,
        label: fieldLabel,
        value: rawValue,
        displayValue,
      });
    }

    const uniqueAssignees = Array.from(
      new Map(itemAssignees.map((a) => [a.id, a])).values()
    );

    const boardItem: BoardItem = {
      id: item.id,
      title,
      statusValue,
      fields: parsedFields,
      assignees: uniqueAssignees,
      rawItem: { id: item.id, title, columnValues: fields },
      sourceWorkspaceId: workspace.id,
      sourceListId: listId,
      workspaceName: workspace.name,
    };

    const col = boardColumns.find((c) => c.id === statusValue);
    if (col) {
      col.items.push(boardItem);
    } else {
      boardColumns[0].items.push(boardItem);
    }
  }

  return {
    meta: {
      listId,
      listTitle,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      statusColumnId,
    },
    columns: boardColumns,
    schema: schemaFields,
  };
}

function extractTextFromField(field: Record<string, unknown>): string {
  if (typeof field.text === "string") return field.text;
  if (typeof field.value === "string") {
    try {
      const parsed = JSON.parse(field.value);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((block: Record<string, unknown>) =>
            Array.isArray(block.elements)
              ? (block.elements as Record<string, unknown>[]).flatMap(
                  (section: Record<string, unknown>) =>
                    Array.isArray(section.elements)
                      ? (section.elements as Record<string, unknown>[]).map(
                          (el: Record<string, unknown>) => (el.text as string) || ""
                        )
                      : []
                )
              : []
          )
          .join("");
      }
    } catch {
      return field.value;
    }
  }
  return "";
}

// ── Start server ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Slackdone MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
