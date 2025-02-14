import { PerformanceMetrics } from './performance';

export type AnalysisStatus = 'pending' | 'in_progress' | 'complete' | 'failed';

export interface AnalysisProgress {
  status: AnalysisStatus;
  current: number;
  total: number;
  message: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
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