import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getWorkspaces, getSavedLists, getCompletedAtMap } from "@/lib/store";
import { getListItems, getListItemInfo, getUsersInfo } from "@/lib/slack";
import {
  BoardColumn,
  BoardItem,
  BoardItemField,
  SchemaField,
  UserProfile,
  Workspace,
  SavedList,
} from "@/lib/types";

interface ListMeta {
  listId: string;
  listTitle: string;
  workspaceId: string;
  workspaceName: string;
  statusColumnId: string | null;
  statusColumnKey: string | null;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allWorkspaces = await getWorkspaces(session.userId);
    if (allWorkspaces.length === 0) {
      return NextResponse.json({ columns: [], lists: [] });
    }

    // Fetch saved lists for all workspaces in parallel
    const workspaceListPairs: { workspace: Workspace; savedLists: SavedList[] }[] =
      await Promise.all(
        allWorkspaces.map(async (ws) => {
          const lists = await getSavedLists(session.userId, ws.id);
          return { workspace: ws, savedLists: lists };
        })
      );

    // Flatten to individual list fetches
    const fetchTasks: {
      workspace: Workspace;
      savedList: SavedList;
    }[] = [];
    for (const { workspace, savedLists } of workspaceListPairs) {
      for (const sl of savedLists) {
        fetchTasks.push({ workspace, savedList: sl });
      }
    }

    if (fetchTasks.length === 0) {
      return NextResponse.json({ columns: [], lists: [] });
    }

    // Fetch all boards in parallel
    const results = await Promise.all(
      fetchTasks.map(async ({ workspace, savedList }) => {
        try {
          return await fetchSingleBoard(workspace, savedList);
        } catch (err) {
          console.error(
            `Failed to fetch list ${savedList.listId} from workspace ${workspace.name}:`,
            err
          );
          return null;
        }
      })
    );

    // Merge columns by normalized name
    const mergedColumnMap = new Map<
      string,
      { name: string; items: BoardItem[] }
    >();
    const columnOrder: string[] = [];
    const allLists: ListMeta[] = [];
    const allSchema: SchemaField[] = [];

    for (const result of results) {
      if (!result) continue;
      allLists.push(result.meta);
      allSchema.push(...result.schema);

      for (const col of result.columns) {
        const key = normalizeColumnName(col.name);
        const existing = mergedColumnMap.get(key);
        if (existing) {
          existing.items.push(...col.items);
        } else {
          mergedColumnMap.set(key, {
            name: col.name,
            items: [...col.items],
          });
          columnOrder.push(key);
        }
      }
    }

    // Build final columns: "No Status" first, then in first-seen order
    const noStatusKey = normalizeColumnName("No Status");
    const orderedKeys = [
      noStatusKey,
      ...columnOrder.filter((k) => k !== noStatusKey),
    ];

    const mergedColumns: BoardColumn[] = [];
    for (const key of orderedKeys) {
      const col = mergedColumnMap.get(key);
      if (col) {
        mergedColumns.push({
          id: key,
          name: col.name,
          items: col.items,
        });
      }
    }

    // Hydrate completedAt timestamps from Firestore
    const completedAtMap = await getCompletedAtMap(session.userId);
    for (const col of mergedColumns) {
      for (const item of col.items) {
        item.completedAt = completedAtMap.get(item.id) ?? null;
      }
    }

    // Deduplicate schema by id
    const seenSchemaIds = new Set<string>();
    const dedupedSchema = allSchema.filter((s) => {
      if (seenSchemaIds.has(s.id)) return false;
      seenSchemaIds.add(s.id);
      return true;
    });

    return NextResponse.json({
      columns: mergedColumns,
      lists: allLists.map((m) => ({
        listId: m.listId,
        listTitle: m.listTitle,
        workspaceId: m.workspaceId,
        workspaceName: m.workspaceName,
        statusColumnId: m.statusColumnId,
      })),
      schema: dedupedSchema,
    });
  } catch (err) {
    console.error("Unified board error:", err);
    return NextResponse.json(
      { error: "Failed to load unified board" },
      { status: 500 }
    );
  }
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim();
}

async function fetchSingleBoard(
  workspace: Workspace,
  savedList: SavedList
): Promise<{
  meta: ListMeta;
  columns: BoardColumn[];
  schema: SchemaField[];
}> {
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
          sourceListId: listId,
        };
        schemaFields.push(field);

        if (
          (col.type === "select" || col.type === "status") &&
          !statusColumnId
        ) {
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

  // Build columns
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
        if (
          field.select &&
          Array.isArray(field.select) &&
          field.key !== "name"
        ) {
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

  // Schema lookup
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
      const sf =
        schemaByKey.get(field.key) || schemaById.get(field.column_id);
      if (sf?.type === "people" || sf?.type === "user" || field.people || field.user) {
        const raw = field.people || field.user || field.value;
        const people = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
        for (const userId of people) {
          if (typeof userId === "string") allUserIds.add(userId);
        }
      }
    }
  }

  let userProfiles = new Map<
    string,
    { id: string; name: string; displayName: string; avatar: string }
  >();
  if (allUserIds.size > 0) {
    try {
      // Try bot token first (has broader access), fall back to user token
      userProfiles = await getUsersInfo(
        workspace.botToken || token,
        Array.from(allUserIds)
      );
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

      const sf =
        schemaByKey.get(field.key) || schemaById.get(field.column_id);
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
                itemAssignees.push({
                  id: userId,
                  name: userId,
                  displayName: userId,
                  avatar: "",
                });
              }
            }
          }
          displayValue = names.join(", ");
        }
      } else if (
        fieldType === "select" ||
        fieldType === "status" ||
        field.select
      ) {
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
      statusColumnKey,
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
                          (el: Record<string, unknown>) =>
                            (el.text as string) || ""
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
