export interface StageMetrics {
  name: string;
  duration: number;
  status: 'success' | 'error';
  timestamp: string;
}

export interface ResourceMetric {
  value: number;
  timestamp: string;
}

export interface ResourceMetrics {
  cpu: ResourceMetric[];
  memory: ResourceMetric[];
  network: ResourceMetric[];
}

export interface NetworkMetrics {
  endpoint: string;
  duration: number;
  status: number;
  timestamp: string;
}

export interface PerformanceMetrics {
  totalTime: number;
  apiCalls: number;
  memoryUsage: number;
  timestamp?: Date;
  operations?: {
    [key: string]: {
      startTime: number;
      endTime?: number;
      duration?: number;
      status: 'pending' | 'success' | 'error';
      error?: string;
    };
  };
}

export interface OperationMetrics {
  operationId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export type MetricsCallback = (metrics: PerformanceMetrics) => void;