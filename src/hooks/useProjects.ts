import { useState, useEffect, useCallback } from 'react';
import {
  Project,
  getProjects,
  createProject,
  deleteProject,
  updateProjectName,
  exportProjectAsZip,
} from '../services/projectService';
import { useAuth } from '../modules/auth/AuthContext';

export const useProjects = () => {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getProjects();
      setProjects(list);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addProject = useCallback(async (name: string): Promise<Project> => {
    try {
      const newProject = await createProject(name);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const renameProject = useCallback(async (id: string, newName: string) => {
    try {
      await updateProjectName(id, newName);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const exportProject = useCallback(async (id: string, name?: string) => {
    try {
      await exportProjectAsZip(id, name);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    loadProjects();
  }, [user, authLoading, loadProjects]);

  return { projects, loading, error, loadProjects, addProject, renameProject, removeProject, exportProject };
};
