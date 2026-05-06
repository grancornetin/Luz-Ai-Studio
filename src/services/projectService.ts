import { db, auth } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';

// ── Core types ────────────────────────────────────────────────

export interface ProjectItem {
  id: string;
  type: 'reference' | 'result';
  url: string;
  module: string;
  metadata?: Record<string, any>;
}

export interface ProjectMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
  actions?: any[];
  timestamp: number;
}

export interface ProjectBrief {
  productDescription: string;
  goal: string;
  audience: string;
  platform: string;
  suggestedModules: string[];
  updatedAt: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  module: string;
  params: Record<string, string>;
  status: 'pending' | 'done' | 'published';
  createdAt: number;
}

export interface CalendarEntry {
  id: string;
  date: string;          // ISO date "2026-05-10"
  dayLabel: string;      // "Lunes 10 mayo"
  contentType: string;   // "Campaña de producto"
  module: string;        // "campaign" | "photodump" | etc.
  params: Record<string, string>;
  prompt: string;
  status: 'pending' | 'done' | 'skipped';
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  items: ProjectItem[];
  // Copilot extensions
  brief?: ProjectBrief;
  conversation?: ProjectMessage[];
  checklist?: ChecklistItem[];
  calendar?: CalendarEntry[];
}

// ── Helpers ───────────────────────────────────────────────────

const getProjectsCollectionRef = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');
  return collection(db, 'users', user.uid, 'projects');
};

const getProjectDocRef = (projectId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');
  return doc(db, 'users', user.uid, 'projects', projectId);
};

// ── CRUD básico ───────────────────────────────────────────────

export const createProject = async (name: string): Promise<Project> => {
  const colRef = getProjectsCollectionRef();
  const now = Timestamp.now();
  const docRef = await addDoc(colRef, {
    name, createdAt: now, updatedAt: now,
    items: [], conversation: [], checklist: [], calendar: [],
  });
  return { id: docRef.id, name, createdAt: now, updatedAt: now, items: [], conversation: [], checklist: [], calendar: [] };
};

export const getProjects = async (): Promise<Project[]> => {
  const colRef = getProjectsCollectionRef();
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
};

export const getProject = async (projectId: string): Promise<Project | null> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Project;
};

export const updateProjectName = async (projectId: string, newName: string): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  await updateDoc(docRef, { name: newName, updatedAt: Timestamp.now() });
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  await deleteDoc(docRef);
};

// ── Items ─────────────────────────────────────────────────────

export const addItemToProject = async (
  projectId: string,
  item: Omit<ProjectItem, 'id'>
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Proyecto no encontrado');
  const currentItems: ProjectItem[] = snap.data().items || [];
  if (currentItems.some(i => i.url === item.url)) return;
  const newItems = [...currentItems, { ...item, id: uuidv4() }];
  await updateDoc(docRef, { items: newItems, updatedAt: Timestamp.now() });
};

export const removeItemFromProject = async (projectId: string, itemId: string): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Proyecto no encontrado');
  const currentItems: ProjectItem[] = snap.data().items || [];
  await updateDoc(docRef, {
    items: currentItems.filter(i => i.id !== itemId),
    updatedAt: Timestamp.now(),
  });
};

// ── Conversación (memoria del copiloto) ──────────────────────

export const saveConversation = async (
  projectId: string,
  messages: ProjectMessage[],
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  // Guardamos solo los últimos 40 mensajes para no crecer indefinidamente
  const trimmed = messages.slice(-40);
  await updateDoc(docRef, { conversation: trimmed, updatedAt: Timestamp.now() });
};

// ── Brief del proyecto ────────────────────────────────────────

export const saveBrief = async (
  projectId: string,
  brief: Omit<ProjectBrief, 'updatedAt'>,
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  await updateDoc(docRef, {
    brief: { ...brief, updatedAt: Date.now() },
    updatedAt: Timestamp.now(),
  });
};

// ── Checklist de campaña ──────────────────────────────────────

export const saveChecklist = async (
  projectId: string,
  checklist: ChecklistItem[],
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  await updateDoc(docRef, { checklist, updatedAt: Timestamp.now() });
};

export const updateChecklistItemStatus = async (
  projectId: string,
  itemId: string,
  status: ChecklistItem['status'],
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const checklist: ChecklistItem[] = snap.data().checklist || [];
  const updated = checklist.map(i => i.id === itemId ? { ...i, status } : i);
  await updateDoc(docRef, { checklist: updated, updatedAt: Timestamp.now() });
};

// ── Calendario de contenido ───────────────────────────────────

export const saveCalendar = async (
  projectId: string,
  calendar: CalendarEntry[],
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  await updateDoc(docRef, { calendar, updatedAt: Timestamp.now() });
};

export const updateCalendarEntryStatus = async (
  projectId: string,
  entryId: string,
  status: CalendarEntry['status'],
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const calendar: CalendarEntry[] = snap.data().calendar || [];
  const updated = calendar.map(e => e.id === entryId ? { ...e, status } : e);
  await updateDoc(docRef, { calendar: updated, updatedAt: Timestamp.now() });
};

// ── Export ZIP ────────────────────────────────────────────────

export const exportProjectAsZip = async (projectId: string, projectName?: string): Promise<void> => {
  const project = await getProject(projectId);
  if (!project) throw new Error('Proyecto no encontrado');

  const zip = new JSZip();
  const safeName = (projectName || project.name).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const refFolder     = zip.folder('referencias')!;
  const resultsFolder = zip.folder('resultados')!;
  const metadata: any[] = [];

  const fetchBlob = async (url: string): Promise<Blob> => {
    if (url.startsWith('data:')) return await (await fetch(url)).blob();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error descargando: ${url}`);
    return await res.blob();
  };

  for (const item of project.items) {
    try {
      const blob = await fetchBlob(item.url);
      const ext = blob.type.split('/')[1] || 'png';
      const filename = `${item.module}_${item.id}.${ext}`;
      const folder = item.type === 'reference' ? refFolder : resultsFolder;
      folder.file(filename, blob);
      metadata.push({ id: item.id, type: item.type, module: item.module, filename, metadata: item.metadata });
    } catch (err) {
      console.warn(`No se pudo agregar imagen ${item.url}`, err);
    }
  }

  // Incluir checklist y calendario en el ZIP como TXT legible
  if (project.checklist && project.checklist.length > 0) {
    const checklistTxt = project.checklist
      .map(i => `[${i.status === 'done' ? 'x' : ' '}] ${i.label} — ${i.module}`)
      .join('\n');
    zip.file('plan_de_contenido.txt', checklistTxt);
  }

  if (project.calendar && project.calendar.length > 0) {
    const calTxt = project.calendar
      .map(e => `${e.dayLabel}: ${e.contentType} [${e.status}]\nPrompt: ${e.prompt}`)
      .join('\n\n');
    zip.file('calendario.txt', calTxt);
  }

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${safeName}_proyecto.zip`);
};
