import { create } from 'zustand';
import type { FileNode, Module, WorkflowNode, WorkflowEdge, AnalysisProgress } from '@/types';
import { AnalyzedRepo } from './useAnalyzedReposStore';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AnalyzerState {
  repository: AnalyzedRepo | null;
  files: FileNode[];
  modules: Module[];
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  loading: boolean;
  error: string | null;
  analysisProgress: AnalysisProgress | null;
  setRepository: (repo: AnalyzedRepo) => void;
  setFiles: (files: FileNode[]) => void;
  setModules: (modules: Module[]) => void;
  setWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnalysisProgress: (progress: AnalysisProgress | null) => void;
}

const initialState: Omit<AnalyzerState, 'setRepository' | 'setFiles' | 'setModules' | 'setWorkflow' | 'setLoading' | 'setError' | 'setAnalysisProgress'> = {
  repository: null,
  files: [],
  modules: [],
  workflow: {
    nodes: [],
    edges: [],
  },
  loading: false,
  error: null,
  analysisProgress: null,
};

// Create a no-op storage for SSR
const createNoopStorage = () => ({
  getItem: () => Promise.resolve(String(null)),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
});

function createStore(preloadedState: Partial<AnalyzerState> = {}) {
  return create<AnalyzerState>()(
    persist(
      (set) => ({
        ...initialState,
        ...preloadedState,
        setRepository: (repo) => set({ repository: repo }),
        setFiles: (files) => set({ files }),
        setModules: (modules) => set({ modules }),
        setWorkflow: (nodes, edges) => set({ workflow: { nodes, edges } }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
      }),
      {
        name: 'analyzer-storage',
        storage: createJSONStorage(() => {
          // During SSR, use no-op storage
          if (typeof window === 'undefined') {
            return createNoopStorage();
          }
          return localStorage;
        }),
        skipHydration: true, // Skip hydration during SSR
        partialize: (state) => ({
          repository: state.repository,
          files: state.files,
          modules: state.modules,
        }),
      }
    )
  );
}

// Store singleton instance
let store: ReturnType<typeof createStore> | null = null;

// Helper function to update analysis progress from outside React components
export function updateAnalysisProgress(progress: AnalysisProgress | null) {
  if (typeof window === 'undefined') return;
  const currentStore = store || createStore();
  currentStore.setState((state) => ({ ...state, analysisProgress: progress }));
}

export function useStore(initState?: Partial<AnalyzerState>) {
  // For SSR, always return a new store with initial state
  if (typeof window === 'undefined') {
    return createStore({
      ...initialState,
      ...initState,
    });
  }

  // For client-side, maintain singleton pattern
  if (!store) {
    store = createStore(initState);
  }

  return store;
}