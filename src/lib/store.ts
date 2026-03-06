import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  query,
  where,
} from "firebase/firestore";
import { Workspace, SavedList, User, SavedView } from "./types";

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      apiKey: process.env.FIREBASE_API_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

function userWorkspacesPath(userId: string) {
  return `users/${userId}/workspaces`;
}

function savedListsPath(userId: string, workspaceId: string) {
  return `users/${userId}/workspaces/${workspaceId}/savedLists`;
}

export async function ensureUser(user: { id: string; name: string; avatar: string }) {
  const db = getDb();
  const ref = doc(db, "users", user.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const userData: User = {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      createdAt: Date.now(),
    };
    await setDoc(ref, userData);
  }
}

export async function getWorkspaces(userId: string): Promise<Workspace[]> {
  const db = getDb();
  const snapshot = await getDocs(collection(db, userWorkspacesPath(userId)));
  return snapshot.docs.map((d) => d.data() as Workspace);
}

export async function getWorkspace(
  userId: string,
  id: string
): Promise<Workspace | undefined> {
  const db = getDb();
  const snap = await getDoc(doc(db, userWorkspacesPath(userId), id));
  return snap.exists() ? (snap.data() as Workspace) : undefined;
}

export async function addWorkspace(userId: string, workspace: Workspace) {
  const db = getDb();
  await setDoc(doc(db, userWorkspacesPath(userId), workspace.id), workspace);
}

export async function removeWorkspace(userId: string, id: string) {
  const db = getDb();
  await deleteDoc(doc(db, userWorkspacesPath(userId), id));
}

// Saved lists (subcollection under workspace)
export async function getSavedLists(userId: string, workspaceId: string): Promise<SavedList[]> {
  const db = getDb();
  const snapshot = await getDocs(
    collection(db, savedListsPath(userId, workspaceId))
  );
  return snapshot.docs.map((d) => d.data() as SavedList);
}

export async function addSavedList(userId: string, workspaceId: string, list: SavedList) {
  const db = getDb();
  await setDoc(
    doc(db, savedListsPath(userId, workspaceId), list.listId),
    list
  );
}

export async function removeSavedList(userId: string, workspaceId: string, listId: string) {
  const db = getDb();
  await deleteDoc(doc(db, savedListsPath(userId, workspaceId), listId));
}

// API key management
export async function setApiKey(userId: string, key: string) {
  const db = getDb();
  await updateDoc(doc(db, "users", userId), { apiKey: key });
}

export async function getApiKey(userId: string): Promise<string | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  return snap.data().apiKey ?? null;
}

export async function deleteApiKey(userId: string) {
  const db = getDb();
  await updateDoc(doc(db, "users", userId), { apiKey: deleteField() });
}

export async function getUserIdByApiKey(apiKey: string): Promise<string | null> {
  const db = getDb();
  const q = query(collection(db, "users"), where("apiKey", "==", apiKey));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

// Board preferences (column order, hidden, minimized)
export interface BoardPreferences {
  columnOrder?: string[];
  hiddenColumns?: string[];
  minimizedColumns?: string[];
}

export async function getBoardPreferences(userId: string): Promise<BoardPreferences | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  return snap.data().boardPreferences ?? null;
}

export async function updateBoardPreferences(userId: string, prefs: BoardPreferences) {
  const db = getDb();
  await updateDoc(doc(db, "users", userId), { boardPreferences: prefs });
}

// Saved views (filter presets)
export async function getSavedViews(userId: string): Promise<SavedView[]> {
  const db = getDb();
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return [];
  return snap.data().savedViews ?? [];
}

export async function updateSavedViews(userId: string, views: SavedView[]) {
  const db = getDb();
  await updateDoc(doc(db, "users", userId), { savedViews: views });
}

// Legacy accessors for migration
export async function getLegacyWorkspaces(): Promise<Workspace[]> {
  const db = getDb();
  const snapshot = await getDocs(collection(db, "workspaces"));
  return snapshot.docs.map((d) => d.data() as Workspace);
}

export async function getLegacySavedLists(workspaceId: string): Promise<SavedList[]> {
  const db = getDb();
  const snapshot = await getDocs(
    collection(db, "workspaces", workspaceId, "savedLists")
  );
  return snapshot.docs.map((d) => d.data() as SavedList);
}
