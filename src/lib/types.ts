// Stored workspace connection
export interface Workspace {
  id: string;
  name: string;
  botToken: string;
  userToken?: string;
}

export interface WorkspaceStore {
  workspaces: Workspace[];
}

// Slack List types
export interface SlackList {
  id: string;
  title: string;
}

export interface SlackListColumn {
  id: string;
  name: string;
  type: string;
  options?: SlackListColumnOption[];
}

export interface SlackListColumnOption {
  id: string;
  name: string;
  color?: string;
}

export interface SlackListItem {
  id: string;
  title: string;
  columnValues: Record<string, SlackListItemValue>;
}

export interface SlackListItemValue {
  columnId: string;
  value: string | string[];
  textValue?: string;
}

// Saved list reference
export interface SavedList {
  listId: string;
  title: string;
  workspaceId: string;
  addedAt: number;
}

// Schema field from list metadata
export interface SchemaField {
  id: string;
  key: string;
  type: string;
  label: string;
  options?: { value: string; label: string; color?: string }[];
}

// Parsed field on a board item
export interface BoardItemField {
  columnId: string;
  key: string;
  type: string;
  label: string;
  value: unknown;
  displayValue: string;
}

// User profile for people fields
export interface UserProfile {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
}

// Board view types
export interface BoardData {
  listId: string;
  listTitle: string;
  statusColumn: SlackListColumn | null;
  columns: BoardColumn[];
  schema?: SchemaField[];
}

export interface BoardColumn {
  id: string;
  name: string;
  items: BoardItem[];
}

export interface BoardItem {
  id: string;
  title: string;
  statusValue: string;
  fields?: BoardItemField[];
  assignees?: UserProfile[];
  rawItem: SlackListItem;
}
