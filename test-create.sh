#!/bin/bash
# Test script: create a task and update it
# Usage: ./test-create.sh [base_url]

BASE="${1:-http://localhost:3000}"
API_KEY="6e8a18a26f91bf0a2c31bd83a5b8c8df48b9448526d7d8fa0b9c66930bd4306f"
LIST_ID="F09DT4E8K40"

# First, get the workspace ID and schema
echo "=== Fetching board data ==="
BOARD=$(curl -s "$BASE/api/unified-board" -H "x-api-key: $API_KEY")
WORKSPACE_ID=$(echo "$BOARD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['lists'][0]['workspaceId'])")
STATUS_COL_ID=$(echo "$BOARD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['lists'][0]['statusColumnId'])")
echo "Workspace: $WORKSPACE_ID"
echo "Status column ID: $STATUS_COL_ID"

# Get list schema
echo ""
echo "=== Fetching list schema ==="
LIST_DATA=$(curl -s "$BASE/api/lists/$LIST_ID?workspaceId=$WORKSPACE_ID" -H "x-api-key: $API_KEY")
echo "$LIST_DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('Status column:', json.dumps(d.get('statusColumn'), indent=2))
print()
print('Schema:')
for s in d.get('schema', []):
    print(f'  {s[\"id\"]} | key={s[\"key\"]} | type={s[\"type\"]} | label={s[\"label\"]}')
    if s.get('options'):
        for o in s['options'][:5]:
            print(f'    option: value={o[\"value\"]} label={o[\"label\"]}')
"

# Find To Do option ID
TODO_OPT=$(echo "$LIST_DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
sc = d.get('statusColumn') or {}
for o in sc.get('options', []):
    if 'to do' in o['name'].lower() or 'todo' in o['name'].lower():
        print(o['id'])
        break
")
echo ""
echo "To Do option ID: $TODO_OPT"

# Step 1: Create item
echo ""
echo "=== Creating item ==="
CREATE_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE/api/lists/$LIST_ID/items" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"fields\": {}}")
echo "$CREATE_RES"

ITEM_ID=$(echo "$CREATE_RES" | head -1 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('item',{}).get('id',''))" 2>/dev/null)
echo "New item ID: $ITEM_ID"

if [ -z "$ITEM_ID" ]; then
  echo "Failed to create item"
  exit 1
fi

# Step 2: Try setting title with PATCH
echo ""
echo "=== PATCH: Set title (column_id=name) ==="
TITLE_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE/api/lists/$LIST_ID/items/$ITEM_ID" \
  -X PATCH \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"cells\": [{\"column_id\": \"name\", \"value\": \"[{\\\"type\\\": \\\"rich_text_section\\\", \\\"elements\\\": [{\\\"type\\\": \\\"text\\\", \\\"text\\\": \\\"Fundraising deck\\\"}]}]\"}]}")
echo "$TITLE_RES"

# Step 3: Try setting status
if [ -n "$TODO_OPT" ]; then
  echo ""
  echo "=== PATCH: Set status to To Do ==="
  STATUS_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE/api/lists/$LIST_ID/items/$ITEM_ID" \
    -X PATCH \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"cells\": [{\"column_id\": \"$STATUS_COL_ID\", \"select\": [\"$TODO_OPT\"]}]}")
  echo "$STATUS_RES"
fi

# Step 4: Try different people column formats
# First find people column ID
PEOPLE_COL=$(echo "$LIST_DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for s in d.get('schema', []):
    if s['type'] in ('people', 'user'):
        print(s['id'])
        break
")
echo ""
echo "People column ID: $PEOPLE_COL"

# Find Daniel and Twinsi user IDs from existing items
echo ""
echo "=== Finding user IDs ==="
echo "$LIST_DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
seen = set()
for col in d.get('columns', []):
    for item in col.get('items', []):
        for a in item.get('assignees', []):
            if a['id'] not in seen:
                seen.add(a['id'])
                print(f'{a[\"id\"]} -> {a[\"displayName\"]}')
"

# Get user IDs for Daniel and Twinsi
USERS=$(echo "$LIST_DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ids = []
for col in d.get('columns', []):
    for item in col.get('items', []):
        for a in item.get('assignees', []):
            name = a['displayName'].lower()
            if 'daniel' in name or 'twinsi' in name:
                if a['id'] not in ids:
                    ids.append(a['id'])
print(','.join(ids))
")
echo "User IDs: $USERS"

if [ -n "$PEOPLE_COL" ] && [ -n "$USERS" ]; then
  IFS=',' read -ra USER_ARRAY <<< "$USERS"
  USERS_JSON=$(python3 -c "import json; print(json.dumps('$USERS'.split(',')))")

  # Try format 1: value as array
  echo ""
  echo "=== PATCH people: value=[userIds] ==="
  curl -s "$BASE/api/lists/$LIST_ID/items/$ITEM_ID" \
    -X PATCH \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"cells\": [{\"column_id\": \"$PEOPLE_COL\", \"value\": $USERS_JSON}]}"
  echo ""

  # Try format 2: people key
  echo ""
  echo "=== PATCH people: people=[userIds] ==="
  curl -s "$BASE/api/lists/$LIST_ID/items/$ITEM_ID" \
    -X PATCH \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"cells\": [{\"column_id\": \"$PEOPLE_COL\", \"people\": $USERS_JSON}]}"
  echo ""

  # Try format 3: users key
  echo ""
  echo "=== PATCH people: users=[userIds] ==="
  curl -s "$BASE/api/lists/$LIST_ID/items/$ITEM_ID" \
    -X PATCH \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"cells\": [{\"column_id\": \"$PEOPLE_COL\", \"users\": $USERS_JSON}]}"
  echo ""

  # Try format 4: value as JSON string of array
  echo ""
  echo "=== PATCH people: value=JSON.stringify([userIds]) ==="
  USERS_STR=$(python3 -c "import json; print(json.dumps(json.dumps('$USERS'.split(','))))")
  curl -s "$BASE/api/lists/$LIST_ID/items/$ITEM_ID" \
    -X PATCH \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspaceId\": \"$WORKSPACE_ID\", \"cells\": [{\"column_id\": \"$PEOPLE_COL\", \"value\": $USERS_STR}]}"
  echo ""
fi

echo ""
echo "=== Done ==="
echo "Delete test item: curl -s -X DELETE '$BASE/api/lists/$LIST_ID/items/$ITEM_ID?workspaceId=$WORKSPACE_ID' -H 'x-api-key: $API_KEY'"
