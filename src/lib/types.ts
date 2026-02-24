// Stored workspace connection
export interface Workspace {
  id: string;
  name: string;
  botToken: string;
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

// Board view types
export interface BoardData {
  listId: string;
  listTitle: string;
  statusColumn: SlackListColumn | null;
  columns: BoardColumn[];
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
  rawItem: SlackListItem;
}
