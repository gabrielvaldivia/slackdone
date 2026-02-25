import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Workspace } from "./types";

function getDb() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

const COLLECTION = "workspaces";

export async function getWorkspaces(): Promise<Workspace[]> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => doc.data() as Workspace);
}

export async function getWorkspace(
  id: string
): Promise<Workspace | undefined> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? (doc.data() as Workspace) : undefined;
}

export async function addWorkspace(workspace: Workspace) {
  const db = getDb();
  await db.collection(COLLECTION).doc(workspace.id).set(workspace);
}

export async function removeWorkspace(id: string) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}
