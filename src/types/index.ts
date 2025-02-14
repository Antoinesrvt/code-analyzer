import { PerformanceMetrics } from './performance';

export type AnalysisStatus = 'pending' | 'in-progress' | 'complete' | 'error';

export interface AnalysisProgress {
  totalFiles: number;
  analyzedFiles: number;
  currentPhase: 'initializing' | 'fetching-repository' | 'analyzing-files' | 'completed' | 'error';
  estimatedTimeRemaining: number;
  status: 'in-progress' | 'complete' | 'error';
  errors: string[];
}

export interface FileNode {
  id: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modules: string[];
  dependencies: string[];
  children?: FileNode[];
  analysisStatus: AnalysisStatus;
}

export interface Module {
  id: string;
  name: string;
  files: FileNode[];
  metrics: {
    totalFiles: number;
    totalSize: number;
    complexity: number;
  };
  analysisStatus: AnalysisStatus;
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: string;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  label?: string;
}