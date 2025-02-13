import { PerformanceMetrics, StageMetrics, ResourceMetrics, NetworkMetrics } from '../types/performance';

class PerformanceMonitor {
  private startTime: number = 0;
  private stages: Map<string, StageMetrics> = new Map();
  private resources: ResourceMetrics = {
    cpu: [],
    memory: [],
    network: [],
  };
  private networkCalls: NetworkMetrics[] = [];

  startMonitoring() {
    this.startTime = performance.now();
  }

  recordStage(stageName: string, duration: number, status: 'success' | 'error' = 'success') {
    this.stages.set(stageName, {
      name: stageName,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  recordResourceUsage(type: keyof ResourceMetrics, value: number) {
    this.resources[type].push({
      value,
      timestamp: new Date().toISOString(),
    });
  }

  recordNetworkCall(endpoint: string, duration: number, status: number) {
    this.networkCalls.push({
      endpoint,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  getMetrics(): PerformanceMetrics {
    const totalDuration = performance.now() - this.startTime;
    const stageMetrics = Array.from(this.stages.values());
    
    const averages = {
      cpu: this.calculateAverage(this.resources.cpu),
      memory: this.calculateAverage(this.resources.memory),
      network: this.calculateAverage(this.resources.network),
    };

    const bottlenecks = this.identifyBottlenecks(stageMetrics, this.networkCalls);

    return {
      totalDuration,
      stages: stageMetrics,
      resources: this.resources,
      networkCalls: this.networkCalls,
      averages,
      bottlenecks,
    };
  }

  private calculateAverage(metrics: { value: number }[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
  }

  private identifyBottlenecks(
    stages: StageMetrics[],
    networkCalls: NetworkMetrics[]
  ): string[] {
    const bottlenecks: string[] = [];
    const THRESHOLDS = {
      STAGE_DURATION: 5000, // 5 seconds
      NETWORK_LATENCY: 1000, // 1 second
      ERROR_RATE: 0.1, // 10%
    };

    // Check for slow stages
    stages.forEach(stage => {
      if (stage.duration > THRESHOLDS.STAGE_DURATION) {
        bottlenecks.push(`Slow stage: ${stage.name} (${stage.duration.toFixed(2)}ms)`);
      }
    });

    // Check for slow network calls
    const slowCalls = networkCalls.filter(call => call.duration > THRESHOLDS.NETWORK_LATENCY);
    if (slowCalls.length > 0) {
      bottlenecks.push(`${slowCalls.length} slow network calls detected`);
    }

    // Check error rates
    const failedCalls = networkCalls.filter(call => call.status >= 400);
    const errorRate = failedCalls.length / networkCalls.length;
    if (errorRate > THRESHOLDS.ERROR_RATE) {
      bottlenecks.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    return bottlenecks;
  }
}

export const performanceMonitor = new PerformanceMonitor();