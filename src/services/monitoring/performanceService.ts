import { AnalysisPerformanceMetrics, StageMetrics, ResourceMetrics, NetworkMetrics } from '../../types/performance';

// Helper function to get current time in milliseconds safely
const getTimeMs = () => {
  if (typeof window === 'undefined') return Date.now();
  return performance?.now?.() ?? Date.now();
};

class PerformanceMonitor {
  private startTime: number = 0;
  private stages: Map<string, StageMetrics> = new Map();
  private resources: ResourceMetrics = {
    cpu: [],
    memory: [],
    network: [],
  };
  private networkCalls: NetworkMetrics[] = [];
  private static instance: PerformanceMonitor | null = null;

  private constructor() {
    // Initialize only on client side
    if (typeof window === "undefined") return;
    this.startTime = getTimeMs();
  }

  public static getInstance(): PerformanceMonitor {
    if (typeof window === "undefined") {
      // Return a dummy instance for SSR that does nothing
      return new PerformanceMonitor();
    }

    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring() {
    if (typeof window === "undefined") return;
    this.startTime = getTimeMs();
  }

  recordStage(
    stageName: string,
    duration: number,
    status: "success" | "error" = "success"
  ) {
    if (typeof window === "undefined") return;
    this.stages.set(stageName, {
      name: stageName,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  recordResourceUsage(type: keyof ResourceMetrics, value: number) {
    if (typeof window === "undefined") return;
    this.resources[type].push({
      value,
      timestamp: new Date().toISOString(),
    });
  }

  recordNetworkCall(endpoint: string, duration: number, status: number) {
    if (typeof window === "undefined") return;
    this.networkCalls.push({
      endpoint,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  getMetrics(): AnalysisPerformanceMetrics {
    if (typeof window === "undefined") {
      return {
        totalDuration: 0,
        stages: [],
        resources: { cpu: [], memory: [], network: [] },
        networkCalls: [],
        averages: { cpu: 0, memory: 0, network: 0 },
        bottlenecks: [],
      };
    }

    const totalDuration = getTimeMs() - this.startTime;
    const stageMetrics = Array.from(this.stages.values());

    const averages = {
      cpu: this.calculateAverage(this.resources.cpu),
      memory: this.calculateAverage(this.resources.memory),
      network: this.calculateAverage(this.resources.network),
    };

    const bottlenecks = this.identifyBottlenecks(
      stageMetrics,
      this.networkCalls
    );

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
    return (
      metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
    );
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
    stages.forEach((stage) => {
      if (stage.duration > THRESHOLDS.STAGE_DURATION) {
        bottlenecks.push(
          `Slow stage: ${stage.name} (${stage.duration.toFixed(2)}ms)`
        );
      }
    });

    // Check for slow network calls
    const slowCalls = networkCalls.filter(
      (call) => call.duration > THRESHOLDS.NETWORK_LATENCY
    );
    if (slowCalls.length > 0) {
      bottlenecks.push(`${slowCalls.length} slow network calls detected`);
    }

    // Check error rates
    const failedCalls = networkCalls.filter((call) => call.status >= 400);
    const errorRate = failedCalls.length / networkCalls.length;
    if (errorRate > THRESHOLDS.ERROR_RATE) {
      bottlenecks.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    return bottlenecks;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();