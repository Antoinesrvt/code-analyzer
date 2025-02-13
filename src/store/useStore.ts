import { create } from 'zustand';
import type { FileNode, Module, WorkflowNode, WorkflowEdge } from '@/types';
import type { Repository } from '@/types/auth';

interface AnalyzerState {
  repository: Repository | null;
  files: FileNode[];
  modules: Module[];
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  loading: boolean;
  error: string | null;
  setRepository: (repo: Repository) => void;
  setFiles: (files: FileNode[]) => void;
  setModules: (modules: Module[]) => void;
  setWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AnalyzerState>((set) => ({
  repository: null,
  files: [],
  modules: [],
  workflow: {
    nodes: [],
    edges: [],
  },
  loading: false,
  error: null,
  setRepository: (repo) => set({ repository: repo }),
  setFiles: (files) => set({ files }),
  setModules: (modules) => set({ modules }),
  setWorkflow: (nodes, edges) => set({ workflow: { nodes, edges } }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));