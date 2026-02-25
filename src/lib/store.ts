import fs from "fs";
import path from "path";
import { Workspace, WorkspaceStore } from "./types";

// Use /tmp on Vercel (read-only filesystem), local data/ dir otherwise
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel
  ? path.join("/tmp", "slackdone")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "workspaces.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): WorkspaceStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    return { workspaces: [] };
  }
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeStore(store: WorkspaceStore) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function getWorkspaces(): Workspace[] {
  return readStore().workspaces;
}

export function getWorkspace(id: string): Workspace | undefined {
  return readStore().workspaces.find((w) => w.id === id);
}

export function addWorkspace(workspace: Workspace) {
  const store = readStore();
  const existing = store.workspaces.findIndex((w) => w.id === workspace.id);
  if (existing >= 0) {
    store.workspaces[existing] = workspace;
  } else {
    store.workspaces.push(workspace);
  }
  writeStore(store);
}

export function removeWorkspace(id: string) {
  const store = readStore();
  store.workspaces = store.workspaces.filter((w) => w.id !== id);
  writeStore(store);
}
