import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useAnalyzedReposStore = create<AnalyzedReposState>()(
  persist(
    (set, get) => ({
      analyzedRepos: [],
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
      partialize: (state) => ({
        analyzedRepos: state.analyzedRepos,
      }),
    }
  )
);