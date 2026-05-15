import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, startAfter,
  serverTimestamp, onSnapshot, type QueryDocumentSnapshot, type QueryConstraint, type DocumentData,
} from 'firebase/firestore';
import { db } from './config';
import { Property, FirestoreRoom, FirestoreItem, MoveTask, MoveTaskCategory, DEFAULT_MOVE_TASKS } from '@/lib/types';

// ── Generic helpers ──────────────────────────────────────────────────────────

export async function createDoc(col: string, data: DocumentData) {
  const ref = await addDoc(collection(db, col), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocById(col: string, id: string, data: Partial<DocumentData>) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocById(col: string, id: string) {
  await deleteDoc(doc(db, col, id));
}

// ── Properties ───────────────────────────────────────────────────────────────

const PROPERTIES_PAGE_SIZE = 10;

export function watchProperties(userId: string, callback: (data: Property[]) => void) {
  const q = query(
    collection(db, 'properties'),
    where('memberUids', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Property))
  );
}

export async function fetchPropertiesPage(
  userId: string,
  cursor: QueryDocumentSnapshot | null,
): Promise<{ items: Property[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const constraints: QueryConstraint[] = [
    where('memberUids', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
    limit(PROPERTIES_PAGE_SIZE + 1),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, 'properties'), ...constraints));
  const hasMore = snap.docs.length > PROPERTIES_PAGE_SIZE;
  const docs = hasMore ? snap.docs.slice(0, PROPERTIES_PAGE_SIZE) : snap.docs;
  return {
    items: docs.map(d => ({ id: d.id, ...d.data() }) as Property),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  };
}

export function watchProperty(propertyId: string, callback: (p: Property | null) => void) {
  return onSnapshot(doc(db, 'properties', propertyId), snap =>
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Property) : null)
  );
}

export async function createProperty(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) {
  return createDoc('properties', data);
}

export async function updateProperty(id: string, data: Partial<Property>) {
  return updateDocById('properties', id, data);
}

export async function deleteProperty(id: string) {
  return deleteDocById('properties', id);
}

// ── Rooms ────────────────────────────────────────────────────────────────────

export function watchRooms(propertyId: string, callback: (data: FirestoreRoom[]) => void) {
  const q = query(
    collection(db, 'rooms'),
    where('propertyId', '==', propertyId),
    orderBy('order', 'asc'),
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as FirestoreRoom))
  );
}

export async function createRoom(data: Omit<FirestoreRoom, 'id' | 'createdAt' | 'updatedAt'>) {
  return createDoc('rooms', data);
}

export async function updateRoom(id: string, data: Partial<FirestoreRoom>) {
  return updateDocById('rooms', id, data);
}

export async function deleteRoom(id: string) {
  return deleteDocById('rooms', id);
}

// ── Items ────────────────────────────────────────────────────────────────────

export function watchItems(propertyId: string, callback: (data: FirestoreItem[]) => void) {
  const q = query(
    collection(db, 'items'),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as FirestoreItem))
  );
}

export async function createItem(data: Omit<FirestoreItem, 'id' | 'createdAt' | 'updatedAt'>) {
  return createDoc('items', data);
}

export async function updateItem(id: string, data: Partial<FirestoreItem>) {
  return updateDocById('items', id, data);
}

export async function deleteItem(id: string) {
  return deleteDocById('items', id);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export function watchTasks(propertyId: string, callback: (data: MoveTask[]) => void) {
  const q = query(
    collection(db, 'tasks'),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MoveTask))
  );
}

export async function createTask(data: Omit<MoveTask, 'id' | 'createdAt' | 'updatedAt'>) {
  return createDoc('tasks', data);
}

export async function updateTask(id: string, data: Partial<Pick<MoveTask, 'text' | 'done' | 'category'>>) {
  return updateDocById('tasks', id, data);
}

export async function deleteTask(id: string) {
  return deleteDocById('tasks', id);
}

export async function seedDefaultTasks(propertyId: string, userId: string) {
  await Promise.all(
    DEFAULT_MOVE_TASKS.map(t =>
      createTask({ propertyId, userId, text: t.text, category: t.category as MoveTaskCategory, done: false })
    )
  );
}

// ── Public / Invite helpers ───────────────────────────────────────────────────

export async function getPropertyById(propertyId: string): Promise<Property | null> {
  const snap = await getDoc(doc(db, 'properties', propertyId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Property) : null;
}

export async function getRoomsForProperty(propertyId: string): Promise<FirestoreRoom[]> {
  const q = query(
    collection(db, 'rooms'),
    where('propertyId', '==', propertyId),
    orderBy('order', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as FirestoreRoom);
}

export async function getItemsForProperty(propertyId: string): Promise<FirestoreItem[]> {
  const q = query(
    collection(db, 'items'),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as FirestoreItem);
}

export async function joinProperty(
  propertyId: string,
  user: { uid: string; email: string | null; displayName: string | null },
): Promise<void> {
  const property = await getPropertyById(propertyId);
  if (!property) throw new Error('Imóvel não encontrado.');
  if (!property.inviteEnabled) throw new Error('O link de convite está desativado.');
  if ((property.memberUids ?? []).includes(user.uid)) return; // already a member
  const newMember: import('@/lib/types').PropertyMember = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName,
    role: 'editor',
  };
  await updateDocById('properties', propertyId, {
    memberUids: [...(property.memberUids ?? []), user.uid],
    members: [...(property.members ?? []), newMember],
  });
}
