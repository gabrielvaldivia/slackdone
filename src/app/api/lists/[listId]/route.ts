import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";
import { getListItems, getListItemInfo, getUsersInfo } from "@/lib/slack";
import { BoardColumn, BoardItem, BoardItemField, SchemaField, UserProfile } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 }
    );
  }

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  try {
    const token = workspace.userToken || workspace.botToken;
    const data = await getListItems(token, listId);
    const items = data.items || [];

    // Get schema from items.info (returns list.list_metadata.schema)
    let listTitle = listId;
    let statusColumnId: string | null = null;
    let statusColumnKey: string | null = null;
    const optionsMap = new Map<string, string>(); // value -> label
    const schemaFields: SchemaField[] = [];

    if (items.length > 0) {
      try {
        const info = await getListItemInfo(token, listId, items[0].id);
        listTitle = info.list?.title || listId;
        const schema = info.list?.list_metadata?.schema || [];

        for (const col of schema) {
          // Build full schema for all fields
          const field: SchemaField = {
            id: col.id,
            key: col.key,
            type: col.type,
            label: col.label || col.key,
            options: col.options?.choices?.map((c: { value: string; label: string; color?: string }) => ({
              value: c.value,
              label: c.label || c.value,
              color: c.color,
            })),
          };
          schemaFields.push(field);

          // Identify status column
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
        // Fall through to inference
      }
    }

    // Build board columns from schema options
    const boardColumns: BoardColumn[] = [
      { id: "__none__", name: "No Status", items: [] },
    ];
    for (const [optId, optLabel] of optionsMap) {
      boardColumns.push({ id: optId, name: optLabel, items: [] });
    }

    // If no schema found, infer from item data
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

    // Build schema lookup
    const schemaByKey = new Map<string, SchemaField>();
    const schemaById = new Map<string, SchemaField>();
    for (const sf of schemaFields) {
      schemaByKey.set(sf.key, sf);
      schemaById.set(sf.id, sf);
    }

    // Collect all user IDs from people fields across all items
    const allUserIds = new Set<string>();
    for (const item of items) {
      const fields = Array.isArray(item.fields) ? item.fields : [];
      for (const field of fields) {
        const sf = schemaByKey.get(field.key) || schemaById.get(field.column_id);
        if (sf?.type === "people" || field.people) {
          const people = field.people || field.value;
          if (Array.isArray(people)) {
            for (const userId of people) {
              if (typeof userId === "string") allUserIds.add(userId);
            }
          }
        }
      }
    }

    // Batch-fetch user profiles
    let userProfiles = new Map<string, { id: string; name: string; displayName: string; avatar: string }>();
    if (allUserIds.size > 0) {
      try {
        userProfiles = await getUsersInfo(workspace.botToken, Array.from(allUserIds));
      } catch {
        // Graceful fallback if users:read scope is missing
      }
    }

    // Sort items into columns
    for (const item of items) {
      const fields = Array.isArray(item.fields) ? item.fields : [];

      // Extract title from "name" field
      let title = "Untitled";
      for (const field of fields) {
        if (field.key === "name") {
          title = field.text || extractTextFromField(field) || "Untitled";
          break;
        }
      }

      // Extract status value
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

      // Parse ALL fields
      const parsedFields: BoardItemField[] = [];
      const itemAssignees: UserProfile[] = [];

      for (const field of fields) {
        if (field.key === "name") continue; // title is shown separately

        const sf = schemaByKey.get(field.key) || schemaById.get(field.column_id);
        const fieldType = sf?.type || "unknown";
        const fieldLabel = sf?.label || field.key || "Unknown";
        const columnId = field.column_id || sf?.id || field.key;

        let displayValue = "";
        let rawValue: unknown = null;

        if (fieldType === "people" || field.people) {
          const people = field.people || field.value;
          if (Array.isArray(people)) {
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

      // Deduplicate assignees by ID
      const uniqueAssignees = Array.from(
        new Map(itemAssignees.map((a) => [a.id, a])).values()
      );

      const boardItem: BoardItem = {
        id: item.id,
        title,
        statusValue,
        fields: parsedFields,
        assignees: uniqueAssignees,
        rawItem: {
          id: item.id,
          title,
          columnValues: fields,
        },
      };

      const col = boardColumns.find((c) => c.id === statusValue);
      if (col) {
        col.items.push(boardItem);
      } else {
        boardColumns[0].items.push(boardItem);
      }
    }

    return NextResponse.json({
      listId,
      listTitle,
      statusColumn: statusColumnId
        ? {
            id: statusColumnId,
            key: statusColumnKey,
            name: "Status",
            type: "select",
            options: Array.from(optionsMap.entries()).map(([id, name]) => ({
              id,
              name,
            })),
          }
        : null,
      columns: boardColumns,
      schema: schemaFields,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Get list items error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
                      ? (
                          section.elements as Record<string, unknown>[]
                        ).map((el: Record<string, unknown>) =>
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
