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
  totalDuration: number;
  stages: StageMetrics[];
  resources: ResourceMetrics;
  networkCalls: NetworkMetrics[];
  averages: {
    cpu: number;
    memory: number;
    network: number;
  };
  bottlenecks: string[];
}