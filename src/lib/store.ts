import * as admin from "firebase-admin";
import { Workspace, SavedList, User } from "./types";

function getDb() {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId!,
          clientEmail,
          // Vercel stores \n as literal characters in env vars
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      // Falls back to GOOGLE_APPLICATION_CREDENTIALS or metadata server
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }
  }
  return admin.firestore();
}

function userWorkspacesPath(userId: string) {
  return `users/${userId}/workspaces`;
}

function savedListsPath(userId: string, workspaceId: string) {
  return `users/${userId}/workspaces/${workspaceId}/savedLists`;
}

export async function ensureUser(user: { id: string; name: string; avatar: string }) {
  const db = getDb();
  const ref = db.collection("users").doc(user.id);
  const snap = await ref.get();
  if (!snap.exists) {
    const userData: User = {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      createdAt: Date.now(),
    };
    await ref.set(userData);
  }
}

export async function getWorkspaces(userId: string): Promise<Workspace[]> {
  const db = getDb();
  const snapshot = await db.collection(userWorkspacesPath(userId)).get();
  return snapshot.docs.map((d) => d.data() as Workspace);
}

export async function getWorkspace(
  userId: string,
  id: string
): Promise<Workspace | undefined> {
  const db = getDb();
  const snap = await db.collection(userWorkspacesPath(userId)).doc(id).get();
  return snap.exists ? (snap.data() as Workspace) : undefined;
}

export async function addWorkspace(userId: string, workspace: Workspace) {
  const db = getDb();
  await db.collection(userWorkspacesPath(userId)).doc(workspace.id).set(workspace);
}

export async function removeWorkspace(userId: string, id: string) {
  const db = getDb();
  await db.collection(userWorkspacesPath(userId)).doc(id).delete();
}

// Saved lists (subcollection under workspace)
export async function getSavedLists(userId: string, workspaceId: string): Promise<SavedList[]> {
  const db = getDb();
  const snapshot = await db.collection(savedListsPath(userId, workspaceId)).get();
  return snapshot.docs.map((d) => d.data() as SavedList);
}

export async function addSavedList(userId: string, workspaceId: string, list: SavedList) {
  const db = getDb();
  await db.collection(savedListsPath(userId, workspaceId)).doc(list.listId).set(list);
}

export async function removeSavedList(userId: string, workspaceId: string, listId: string) {
  const db = getDb();
  await db.collection(savedListsPath(userId, workspaceId)).doc(listId).delete();
}

// API key management
export async function setApiKey(userId: string, key: string) {
  const db = getDb();
  await db.collection("users").doc(userId).update({ apiKey: key });
}

export async function getApiKey(userId: string): Promise<string | null> {
  const db = getDb();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data()?.apiKey ?? null;
}

export async function deleteApiKey(userId: string) {
  const db = getDb();
  await db.collection("users").doc(userId).update({ apiKey: admin.firestore.FieldValue.delete() });
}

export async function getUserIdByApiKey(apiKey: string): Promise<string | null> {
  const db = getDb();
  const snap = await db.collection("users").where("apiKey", "==", apiKey).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

// Board preferences (column order, hidden, minimized)
export interface BoardPreferences {
  columnOrder?: string[];
  hiddenColumns?: string[];
  minimizedColumns?: string[];
  fieldOrder?: string[];
  itemOrder?: Record<string, string[]>;
  activeViewId?: string | null;
}

export async function getBoardPreferences(userId: string): Promise<BoardPreferences | null> {
  const db = getDb();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data()?.boardPreferences ?? null;
}

export async function updateBoardPreferences(userId: string, prefs: BoardPreferences) {
  const db = getDb();
  await db.collection("users").doc(userId).update({ boardPreferences: prefs });
}

// Saved views
export interface SavedView {
  id: string;
  name: string;
  assignees: string[];
  clients: string[];
  properties?: string[];
  columnOrder?: string[];
  minimizedColumns?: string[];
}

export async function getSavedViews(userId: string): Promise<SavedView[]> {
  const db = getDb();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return [];
  return snap.data()?.savedViews ?? [];
}

export async function updateSavedViews(userId: string, views: SavedView[]) {
  const db = getDb();
  await db.collection("users").doc(userId).update({ savedViews: views });
}

// Item completion timestamps
// Stored at: users/{userId}/completions/{itemId}
function completionsPath(userId: string) {
  return `users/${userId}/completions`;
}

export async function setCompletedAt(userId: string, itemId: string, timestamp: string) {
  const db = getDb();
  await db.collection(completionsPath(userId)).doc(itemId).set({ completedAt: timestamp });
}

export async function clearCompletedAt(userId: string, itemId: string) {
  const db = getDb();
  await db.collection(completionsPath(userId)).doc(itemId).delete();
}

export async function getCompletedAtMap(userId: string): Promise<Map<string, string>> {
  const db = getDb();
  const snapshot = await db.collection(completionsPath(userId)).get();
  const map = new Map<string, string>();
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.completedAt) {
      map.set(d.id, data.completedAt);
    }
  }
  return map;
}

// Share tokens (public read-only links)
export interface ShareToken {
  userId: string;
  viewId: string;
  viewSnapshot: SavedView;
  mode: "readonly" | "edit";
  createdAt: number;
}

export async function createShareToken(token: string, data: ShareToken) {
  const db = getDb();
  await db.collection("shareTokens").doc(token).set(data);
}

export async function getShareToken(token: string): Promise<ShareToken | null> {
  const db = getDb();
  const snap = await db.collection("shareTokens").doc(token).get();
  return snap.exists ? (snap.data() as ShareToken) : null;
}

export async function deleteShareToken(token: string) {
  const db = getDb();
  await db.collection("shareTokens").doc(token).delete();
}

// Legacy accessors for migration
export async function getLegacyWorkspaces(): Promise<Workspace[]> {
  const db = getDb();
  const snapshot = await db.collection("workspaces").get();
  return snapshot.docs.map((d) => d.data() as Workspace);
}

export async function getLegacySavedLists(workspaceId: string): Promise<SavedList[]> {
  const db = getDb();
  const snapshot = await db.collection("workspaces").doc(workspaceId).collection("savedLists").get();
  return snapshot.docs.map((d) => d.data() as SavedList);
}
