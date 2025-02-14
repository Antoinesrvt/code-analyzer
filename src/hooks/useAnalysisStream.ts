import { useState, useEffect } from 'react';
import { AnalysisEventSource } from '@/lib/eventSource';
import type { AnalysisStatus } from '@/types';

interface UseAnalysisStreamResult {
  progress: number;
  status: AnalysisStatus;
  error: string | null;
  data: any | null;
}

export function useAnalysisStream(analysisId: string): UseAnalysisStreamResult {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (!analysisId) return;

    const eventSource = new AnalysisEventSource(`/api/analysis/${analysisId}/stream`);
    
    eventSource.connect({
      onProgress: (progress) => {
        setProgress(progress);
        setStatus('analyzing');
        setError(null);
      },
      onComplete: (data) => {
        setData(data);
        setStatus('complete');
        setProgress(100);
        setError(null);
      },
      onError: (error) => {
        setError(error);
        setStatus('error');
      }
    });

    return () => eventSource.disconnect();
  }, [analysisId]);

  return { progress, status, error, data };
} 