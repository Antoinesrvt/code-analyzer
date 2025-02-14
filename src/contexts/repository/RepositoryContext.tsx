'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Repository } from '@/types/auth';
import type { FileNode, Module, AnalysisProgress, WorkflowNode, WorkflowEdge } from '@/types';
import type { AnalysisPerformanceMetrics } from '@/types/performance';
import { useAuth } from '@/contexts/auth/AuthContext';

interface AnalyzedRepo extends Repository {
  lastAnalyzed: string;
  files: FileNode[];
  modules: Module[];
  performanceMetrics?: AnalysisPerformanceMetrics;
  analysisProgress?: AnalysisProgress;
}

interface RepositoryState {
  analyzedRepos: AnalyzedRepo[];
  selectedRepo: AnalyzedRepo | null;
  files: FileNode[];
  modules: Module[];
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  isLoading: boolean;
  error: string | null;
  analysisProgress: AnalysisProgress | null;
}

interface RepositoryContextType extends RepositoryState {
  selectRepository: (repo: Repository) => Promise<void>;
  startAnalysis: (owner: string, repo: string) => Promise<void>;
  refreshAnalysis: (owner: string, repo: string) => Promise<void>;
  deleteAnalysis: (owner: string, repo: string) => Promise<void>;
  getAnalysisProgress: (owner: string, repo: string) => Promise<AnalysisProgress | null>;
  setFiles: (files: FileNode[]) => void;
  setModules: (modules: Module[]) => void;
  setWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  updateAnalysisProgress: (progress: AnalysisProgress | null) => void;
  clearAnalysis: () => void;
}

const RepositoryContext = createContext<RepositoryContextType | null>(null);

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<RepositoryState>({
    analyzedRepos: [],
    selectedRepo: null,
    files: [],
    modules: [],
    workflow: {
      nodes: [],
      edges: [],
    },
    isLoading: false,
    error: null,
    analysisProgress: null,
  });

  useEffect(() => {
    // Only load repositories if authenticated and auth loading is complete
    if (isAuthenticated && !authLoading) {
      loadAnalyzedRepos();
    } else if (!isAuthenticated && !authLoading) {
      // Clear state when not authenticated
      setState(prev => ({
        ...prev,
        analyzedRepos: [],
        selectedRepo: null,
        files: [],
        modules: [],
        workflow: { nodes: [], edges: [] },
        isLoading: false,
        error: null,
        analysisProgress: null,
      }));
    }
  }, [isAuthenticated, authLoading]);

  const loadAnalyzedRepos = async () => {
    if (!isAuthenticated) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/analysis', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analyzed repositories');
      }
      
      const data = await response.json();
      setState(prev => ({
        ...prev,
        analyzedRepos: data.analyses || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load analyzed repos:', error);
      const message = error instanceof Error ? error.message : 'Failed to load analyzed repositories';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  };

  const setFiles = (files: FileNode[]) => {
    setState(prev => ({ ...prev, files }));
  };

  const setModules = (modules: Module[]) => {
    setState(prev => ({ ...prev, modules }));
  };

  const setWorkflow = (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    setState(prev => ({ ...prev, workflow: { nodes, edges } }));
  };

  const updateAnalysisProgress = (progress: AnalysisProgress | null) => {
    setState(prev => ({
      ...prev,
      analysisProgress: progress,
      selectedRepo: prev.selectedRepo
        ? { ...prev.selectedRepo, analysisProgress: progress }
        : null,
    }));
  };

  const clearAnalysis = () => {
    setState(prev => ({
      ...prev,
      selectedRepo: null,
      files: [],
      modules: [],
      workflow: { nodes: [], edges: [] },
      analysisProgress: null,
    }));
  };

  const selectRepository = async (repo: Repository) => {
    if (!isAuthenticated) {
      toast.error('Authentication required', {
        description: 'Please sign in to analyze repositories',
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const existingAnalysis = state.analyzedRepos.find(
        r => r.owner.login === repo.owner.login && r.name === repo.name
      );

      if (existingAnalysis) {
        setState(prev => ({
          ...prev,
          selectedRepo: existingAnalysis,
          isLoading: false,
        }));
        return;
      }

      await startAnalysis(repo.owner.login, repo.name);
    } catch (error) {
      console.error('Failed to select repository:', error);
      const message = error instanceof Error ? error.message : 'Failed to select repository';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Failed to select repository', {
        description: message,
      });
    }
  };

  const startAnalysis = async (owner: string, repo: string) => {
    if (!isAuthenticated) {
      toast.error('Authentication required', {
        description: 'Please sign in to analyze repositories',
      });
      return;
    }

    if (!owner || !repo) {
      toast.error('Invalid repository', {
        description: 'Please select a repository to analyze',
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ owner, repo }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }

      const analysis = await response.json();
      
      setState(prev => ({
        ...prev,
        selectedRepo: analysis,
        analyzedRepos: [analysis, ...prev.analyzedRepos],
        isLoading: false,
      }));

      toast.success('Analysis started', {
        description: `Started analyzing ${owner}/${repo}`,
      });
    } catch (error) {
      console.error('Failed to start analysis:', error);
      const message = error instanceof Error ? error.message : 'Failed to start analysis';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Failed to start analysis', {
        description: message,
      });
    }
  };

  const refreshAnalysis = async (owner: string, repo: string) => {
    if (!isAuthenticated) {
      toast.error('Authentication required', {
        description: 'Please sign in to refresh analysis',
      });
      return;
    }

    if (!owner || !repo) {
      toast.error('Invalid repository', {
        description: 'Please select a repository to refresh',
      });
      return;
    }

    if (!state.selectedRepo) {
      toast.error('No repository selected', {
        description: 'Please select a repository first',
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch(`/api/analysis/${owner}/${repo}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh analysis');
      }

      const analysis = await response.json();
      
      setState(prev => ({
        ...prev,
        selectedRepo: analysis,
        analyzedRepos: prev.analyzedRepos.map(r => 
          r.owner.login === owner && r.name === repo ? analysis : r
        ),
        isLoading: false,
      }));

      toast.success('Analysis refreshed', {
        description: `Successfully refreshed analysis for ${owner}/${repo}`,
      });
    } catch (error) {
      console.error('Failed to refresh analysis:', error);
      const message = error instanceof Error ? error.message : 'Failed to refresh analysis';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Failed to refresh analysis', {
        description: message,
      });
    }
  };

  const deleteAnalysis = async (owner: string, repo: string) => {
    if (!isAuthenticated) {
      toast.error('Authentication required', {
        description: 'Please sign in to delete analysis',
      });
      return;
    }

    if (!owner || !repo) {
      toast.error('Invalid repository', {
        description: 'Please select a repository to delete',
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch(`/api/analysis/${owner}/${repo}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete analysis');
      }

      setState(prev => ({
        ...prev,
        selectedRepo: prev.selectedRepo?.owner.login === owner && prev.selectedRepo.name === repo
          ? null
          : prev.selectedRepo,
        analyzedRepos: prev.analyzedRepos.filter(
          r => !(r.owner.login === owner && r.name === repo)
        ),
        isLoading: false,
      }));

      toast.success('Analysis deleted', {
        description: `Successfully deleted analysis for ${owner}/${repo}`,
      });
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete analysis';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Failed to delete analysis', {
        description: message,
      });
    }
  };

  const getAnalysisProgress = async (owner: string, repo: string): Promise<AnalysisProgress | null> => {
    if (!isAuthenticated) return null;

    if (!owner || !repo || !state.selectedRepo) return null;

    try {
      const response = await fetch(`/api/analysis/${owner}/${repo}/progress`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analysis progress');
      }

      const progress = await response.json();
      
      setState(prev => ({
        ...prev,
        selectedRepo: prev.selectedRepo?.owner.login === owner && prev.selectedRepo.name === repo
          ? { ...prev.selectedRepo, analysisProgress: progress }
          : prev.selectedRepo,
        analyzedRepos: prev.analyzedRepos.map(r =>
          r.owner.login === owner && r.name === repo
            ? { ...r, analysisProgress: progress }
            : r
        ),
      }));

      return progress;
    } catch (error) {
      console.error('Failed to fetch analysis progress:', error);
      return null;
    }
  };

  return (
    <RepositoryContext.Provider
      value={{
        ...state,
        selectRepository,
        startAnalysis,
        refreshAnalysis,
        deleteAnalysis,
        getAnalysisProgress,
        setFiles,
        setModules,
        setWorkflow,
        updateAnalysisProgress,
        clearAnalysis,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
}

export const useRepository = () => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepository must be used within a RepositoryProvider');
  }
  return context;
}; 