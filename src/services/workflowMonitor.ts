import { performanceMonitor } from './performanceService';

interface OperationMetrics {
  operation: string;
  startTime: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  retries: number;
  error?: Error;
}

class WorkflowMonitor {
  private static instance: WorkflowMonitor;
  private operations: Map<string, OperationMetrics> = new Map();
  private readonly TIMEOUT_THRESHOLD = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly BACKOFF_BASE = 1000; // 1 second

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): WorkflowMonitor {
    if (!WorkflowMonitor.instance) {
      WorkflowMonitor.instance = new WorkflowMonitor();
    }
    return WorkflowMonitor.instance;
  }

  startOperation(operationId: string): void {
    console.log(`[Workflow] Starting operation: ${operationId}`);
    this.operations.set(operationId, {
      operation: operationId,
      startTime: performance.now(),
      status: 'pending',
      retries: 0,
    });
  }

  endOperation(operationId: string, status: 'success' | 'error' = 'success', error?: Error): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`[Workflow] No matching start for operation: ${operationId}`);
      return;
    }

    const duration = performance.now() - operation.startTime;
    console.log(`[Workflow] Completed operation: ${operationId} (${duration.toFixed(2)}ms)`);
    
    this.operations.set(operationId, {
      ...operation,
      duration,
      status,
      error,
    });

    // Record in performance monitor
    performanceMonitor.recordStage(operationId, duration, status);
  }

  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    options: {
      timeout?: number;
      maxRetries?: number;
      backoffBase?: number;
    } = {}
  ): Promise<T> {
    const {
      timeout = this.TIMEOUT_THRESHOLD,
      maxRetries = this.MAX_RETRIES,
      backoffBase = this.BACKOFF_BASE,
    } = options;

    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= maxRetries) {
      this.startOperation(operationId);
      
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation ${operationId} timed out after ${timeout}ms`));
          }, timeout);
        });

        // Race between the operation and timeout
        const result = await Promise.race([
          operation(),
          timeoutPromise,
        ]);

        this.endOperation(operationId, 'success');
        return result as T;  // Safe assertion since operation returns Promise<T>
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;

        console.error(
          `[Workflow] Operation ${operationId} failed (attempt ${retries}/${maxRetries}):`,
          lastError
        );

        this.endOperation(operationId, 'error', lastError);

        if (retries <= maxRetries) {
          // Calculate exponential backoff
          const backoffDelay = backoffBase * Math.pow(2, retries - 1);
          console.log(`[Workflow] Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    throw lastError || new Error(`Operation ${operationId} failed after ${maxRetries} retries`);
  }

  getOperationMetrics(operationId: string): OperationMetrics | undefined {
    return this.operations.get(operationId);
  }

  getAllMetrics(): OperationMetrics[] {
    return Array.from(this.operations.values());
  }

  getAverageOperationTime(operationId: string): number {
    const operations = Array.from(this.operations.values())
      .filter(op => op.operation === operationId && op.duration !== undefined);
    
    if (operations.length === 0) return 0;
    
    const totalTime = operations.reduce((sum, op) => sum + (op.duration || 0), 0);
    return totalTime / operations.length;
  }

  getSuccessRate(operationId: string): number {
    const operations = Array.from(this.operations.values())
      .filter(op => op.operation === operationId);
    
    if (operations.length === 0) return 0;
    
    const successfulOps = operations.filter(op => op.status === 'success');
    return (successfulOps.length / operations.length) * 100;
  }

  logMetrics(): void {
    console.group('Workflow Health Metrics');
    
    // Log overall statistics
    const allOperations = this.getAllMetrics();
    const totalOps = allOperations.length;
    const successfulOps = allOperations.filter(op => op.status === 'success').length;
    const failedOps = allOperations.filter(op => op.status === 'error').length;
    
    console.log('Overall Statistics:');
    console.log(`Total Operations: ${totalOps}`);
    console.log(`Success Rate: ${((successfulOps / totalOps) * 100).toFixed(2)}%`);
    console.log(`Failure Rate: ${((failedOps / totalOps) * 100).toFixed(2)}%`);

    // Log individual operation metrics
    console.group('Operation Metrics:');
    const uniqueOperations = new Set(allOperations.map(op => op.operation));
    
    uniqueOperations.forEach(opId => {
      const avgTime = this.getAverageOperationTime(opId);
      const successRate = this.getSuccessRate(opId);
      
      console.group(opId);
      console.log(`Average Time: ${avgTime.toFixed(2)}ms`);
      console.log(`Success Rate: ${successRate.toFixed(2)}%`);
      console.groupEnd();
    });
    
    console.groupEnd();
    console.groupEnd();
  }
}

export const workflowMonitor = WorkflowMonitor.getInstance();