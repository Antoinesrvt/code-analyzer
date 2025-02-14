export class AnalysisEventSource {
  private eventSource: EventSource | null = null;
  
  constructor(private url: string) {}
  
  connect(handlers: {
    onProgress: (progress: number) => void;
    onComplete: (data: any) => void;
    onError: (error: string) => void;
  }) {
    this.eventSource = new EventSource(this.url);
    
    this.eventSource.addEventListener('progress', ((e: MessageEvent) => {
      const data = JSON.parse(e.data);
      handlers.onProgress(data.progress);
    }) as EventListener);
    
    this.eventSource.addEventListener('complete', ((e: MessageEvent) => {
      const data = JSON.parse(e.data);
      handlers.onComplete(data);
      this.disconnect(); // Close connection on completion
    }) as EventListener);
    
    this.eventSource.addEventListener('error', ((e: MessageEvent) => {
      const error = e.data ? JSON.parse(e.data).message : 'Connection error';
      handlers.onError(error);
      this.disconnect(); // Close connection on error
    }) as EventListener);

    // Handle connection errors
    this.eventSource.onerror = () => {
      handlers.onError('Connection lost');
      this.disconnect();
    };
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
} 