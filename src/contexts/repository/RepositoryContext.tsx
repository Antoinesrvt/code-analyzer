'use client';

import { createContext, useContext, useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Repository } from '@/types/auth';
import type { FileNode, Module, AnalysisProgress, WorkflowNode, WorkflowEdge } from '@/types';
import type { AnalysisPerformanceMetrics } from '@/types/performance';
import { useAuth } from '@/contexts/auth/AuthContext';
import React from 'react';

interface AnalyzedRepo extends Repository {
  lastAnalyzed: string;
  files: FileNode[];
  modules: Module[];
  performanceMetrics?: AnalysisPerformanceMetrics;
  analysisProgress?: AnalysisProgress;
}

interface RepositoryState {
  selectedRepo: AnalyzedRepo | null;
  files: FileNode[];
  modules: Module[];
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  analysisProgress: AnalysisProgress | null;
  isLoading: boolean;
  error: Error | null;
}

interface RepositoryContextType extends RepositoryState {
  analyzedRepos: AnalyzedRepo[];
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

// API functions
async function fetchAnalyzedRepos() {
  const response = await fetch('/api/analysis', { credentials: 'include' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to fetch analyzed repositories');
  }
  return response.json();
}

async function startAnalysisRequest(owner: string, repo: string) {
  const response = await fetch('/api/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ owner, repo }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to start analysis');
  }

  return response.json();
}

async function deleteAnalysisRequest(owner: string, repo: string) {
  const response = await fetch(`/api/analysis?repositoryId=${encodeURIComponent(`${owner}/${repo}`)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to delete analysis');
  }

  return response.json();
}

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const { githubUser } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RepositoryState>({
    selectedRepo: null,
    files: [],
    modules: [],
    workflow: { nodes: [], edges: [] },
    analysisProgress: null,
    isLoading: false,
    error: null,
  });

  // Fetch analyzed repositories
  const { 
    data: analyzedRepos = [], 
    isLoading: isReposLoading,
    error: reposError
  } = useQuery({
    queryKey: ['analyzedRepos'],
    queryFn: fetchAnalyzedRepos,
    enabled: !!githubUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Start analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) => 
      startAnalysisRequest(owner, repo),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['analyzedRepos'] });
      setState(prev => ({ 
        ...prev, 
        selectedRepo: data,
        isLoading: false,
        error: null
      }));
    },
    onError: (error) => {
      setState(prev => ({ ...prev, error: error as Error }));
      toast.error('Failed to start analysis', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    },
  });

  // Delete analysis mutation
  const deleteAnalysisMutation = useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) => 
      deleteAnalysisRequest(owner, repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyzedRepos'] });
      setState(prev => ({ ...prev, selectedRepo: null }));
    },
    onError: (error) => {
      toast.error('Failed to delete analysis', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    },
  });

  // Update loading state based on mutations and queries
  React.useEffect(() => {
    setState(prev => ({
      ...prev,
      isLoading: isReposLoading || startAnalysisMutation.isPending || deleteAnalysisMutation.isPending,
      error: reposError as Error || startAnalysisMutation.error as Error || deleteAnalysisMutation.error as Error || null
    }));
  }, [isReposLoading, startAnalysisMutation.isPending, deleteAnalysisMutation.isPending, reposError, startAnalysisMutation.error, deleteAnalysisMutation.error]);

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
    setState(prev => ({ ...prev, analysisProgress: progress }));
  };

  const clearAnalysis = () => {
    setState({
      selectedRepo: null,
      files: [],
      modules: [],
      workflow: { nodes: [], edges: [] },
      analysisProgress: null,
      isLoading: false,
      error: null,
    });
  };

  const selectRepository = async (repo: Repository) => {
    const existingAnalysis = analyzedRepos.find(
      (r: AnalyzedRepo) => r.id === repo.id
    );

    if (existingAnalysis) {
      setState(prev => ({ ...prev, selectedRepo: existingAnalysis }));
    } else {
      await startAnalysisMutation.mutateAsync({
        owner: repo.owner.login,
        repo: repo.name,
      });
    }
  };

  const startAnalysis = async (owner: string, repo: string) => {
    await startAnalysisMutation.mutateAsync({ owner, repo });
  };

  const refreshAnalysis = async (owner: string, repo: string) => {
    await startAnalysisMutation.mutateAsync({ owner, repo });
  };

  const deleteAnalysis = async (owner: string, repo: string) => {
    await deleteAnalysisMutation.mutateAsync({ owner, repo });
  };

  const getAnalysisProgress = async (owner: string, repo: string) => {
    try {
      const response = await fetch(
        `/api/analysis/progress?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || error.error || 'Failed to fetch analysis progress');
      }

      const progress = await response.json();
      updateAnalysisProgress(progress);
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
        analyzedRepos,
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