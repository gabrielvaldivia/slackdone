import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Workspace, SavedList } from "./types";

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      apiKey: process.env.FIREBASE_API_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

const COLLECTION = "workspaces";

export async function getWorkspaces(): Promise<Workspace[]> {
  const db = getDb();
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map((d) => d.data() as Workspace);
}

export async function getWorkspace(
  id: string
): Promise<Workspace | undefined> {
  const db = getDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? (snap.data() as Workspace) : undefined;
}

export async function addWorkspace(workspace: Workspace) {
  const db = getDb();
  await setDoc(doc(db, COLLECTION, workspace.id), workspace);
}

export async function removeWorkspace(id: string) {
  const db = getDb();
  await deleteDoc(doc(db, COLLECTION, id));
}

// Saved lists (subcollection under workspace)
export async function getSavedLists(workspaceId: string): Promise<SavedList[]> {
  const db = getDb();
  const snapshot = await getDocs(
    collection(db, COLLECTION, workspaceId, "savedLists")
  );
  return snapshot.docs.map((d) => d.data() as SavedList);
}

export async function addSavedList(workspaceId: string, list: SavedList) {
  const db = getDb();
  await setDoc(
    doc(db, COLLECTION, workspaceId, "savedLists", list.listId),
    list
  );
}

export async function removeSavedList(workspaceId: string, listId: string) {
  const db = getDb();
  await deleteDoc(doc(db, COLLECTION, workspaceId, "savedLists", listId));
}
