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

export interface ProjectItem {
  id: string;
  type: 'reference' | 'result';
  url: string;
  module: string;
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  items: ProjectItem[];
}

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

export const createProject = async (name: string): Promise<Project> => {
  const colRef = getProjectsCollectionRef();
  const now = Timestamp.now();
  const docRef = await addDoc(colRef, { name, createdAt: now, updatedAt: now, items: [] });
  return { id: docRef.id, name, createdAt: now, updatedAt: now, items: [] };
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

export const addItemToProject = async (
  projectId: string,
  item: Omit<ProjectItem, 'id'>
): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Proyecto no encontrado');
  const currentItems: ProjectItem[] = snap.data().items || [];
  const exists = currentItems.some((i) => i.url === item.url);
  if (exists) return;
  const newItems = [...currentItems, { ...item, id: uuidv4() }];
  await updateDoc(docRef, { items: newItems, updatedAt: Timestamp.now() });
};

export const removeItemFromProject = async (projectId: string, itemId: string): Promise<void> => {
  const docRef = getProjectDocRef(projectId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Proyecto no encontrado');
  const currentItems: ProjectItem[] = snap.data().items || [];
  const newItems = currentItems.filter((i) => i.id !== itemId);
  await updateDoc(docRef, { items: newItems, updatedAt: Timestamp.now() });
};

export const exportProjectAsZip = async (projectId: string, projectName?: string): Promise<void> => {
  const project = await getProject(projectId);
  if (!project) throw new Error('Proyecto no encontrado');

  const zip = new JSZip();
  const safeName = (projectName || project.name).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const refFolder = zip.folder('referencias')!;
  const resultsFolder = zip.folder('resultados')!;
  const metadata: any[] = [];

  const fetchBlob = async (url: string): Promise<Blob> => {
    if (url.startsWith('data:')) {
      return await (await fetch(url)).blob();
    }
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
      metadata.push({ id: item.id, type: item.type, module: item.module, filename, originalUrl: item.url, metadata: item.metadata });
    } catch (err) {
      console.warn(`No se pudo agregar imagen ${item.url}`, err);
    }
  }

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${safeName}_proyecto.zip`);
};
