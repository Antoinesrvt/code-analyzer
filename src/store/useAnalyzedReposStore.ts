import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Repository } from '@/types/auth';
import type { FileNode, Module, AnalysisProgress } from '@/types';
import type { PerformanceMetrics } from '@/types/performance';

export interface AnalyzedRepo extends Repository {
  lastAnalyzed: string;
  files: FileNode[];
  modules: Module[];
  performanceMetrics?: PerformanceMetrics;
  analysisProgress?: AnalysisProgress;
}

interface AnalyzedReposState {
  analyzedRepos: AnalyzedRepo[];
  addAnalyzedRepo: (repo: Repository) => void;
  removeAnalyzedRepo: (url: string) => void;
  updateAnalyzedRepo: (url: string, updates: Partial<AnalyzedRepo>) => void;
  clearAnalyzedRepos: () => void;
}

// Create a no-op storage for SSR
const createNoopStorage = () => ({
  getItem: () => Promise.resolve(String(null)),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
});

function createAnalyzedReposStore(preloadedState: Partial<AnalyzedReposState> = {}) {
  return create<AnalyzedReposState>()(
    persist(
      (set) => ({
        analyzedRepos: [],
        ...preloadedState,
        addAnalyzedRepo: (repo) =>
          set((state) => ({
            analyzedRepos: [
              ...state.analyzedRepos,
              {
                ...repo,
                lastAnalyzed: new Date().toISOString(),
                files: [],
                modules: [],
              },
            ],
          })),
        removeAnalyzedRepo: (url) =>
          set((state) => ({
            analyzedRepos: state.analyzedRepos.filter((r) => r.url !== url),
          })),
        updateAnalyzedRepo: (url, updates) =>
          set((state) => ({
            analyzedRepos: state.analyzedRepos.map((repo) =>
              repo.url === url ? { ...repo, ...updates } : repo
            ),
          })),
        clearAnalyzedRepos: () => set({ analyzedRepos: [] }),
      }),
      {
        name: 'analyzed-repos-storage',
        storage: createJSONStorage(() => {
          // During SSR, use no-op storage
          if (typeof window === 'undefined') {
            return createNoopStorage();
          }
          return localStorage;
        }),
        skipHydration: true, // Skip hydration during SSR
        partialize: (state) => ({
          analyzedRepos: state.analyzedRepos,
        }),
      }
    )
  );
}

// Store singleton instance
let store: ReturnType<typeof createAnalyzedReposStore> | null = null;

export function useAnalyzedReposStore(initState?: Partial<AnalyzedReposState>) {
  // For SSR, always return a new store with initial state
  if (typeof window === 'undefined') {
    return createAnalyzedReposStore({
      ...initState,
      analyzedRepos: [],
    });
  }

  // For client-side, maintain singleton pattern
  if (!store) {
    store = createAnalyzedReposStore(initState);
  }

  return store;
}