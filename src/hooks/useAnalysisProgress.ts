import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AnalysisProgress {
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  current: number;
  total: number;
  message: string;
}

interface UseAnalysisProgressOptions {
  analysisId: string;
  enabled?: boolean;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

async function fetchAnalysisProgress(analysisId: string): Promise<AnalysisProgress> {
  const response = await fetch(`/api/analysis/${analysisId}/progress`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch analysis progress');
  }

  const data = await response.json();
  return data.data.analysisProgress;
}

export function useAnalysisProgress({
  analysisId,
  enabled = true,
  onComplete,
  onError
}: UseAnalysisProgressOptions) {
  const [pollInterval, setPollInterval] = useState(2000);

  const { data: progress, error, isLoading } = useQuery({
    queryKey: ['analysisProgress', analysisId],
    queryFn: () => fetchAnalysisProgress(analysisId),
    enabled: enabled && !!analysisId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'complete' || data?.status === 'failed') {
        return false;
      }
      return pollInterval;
    },
    retry: (failureCount, error) => {
      // Don't retry on 404 or if we've tried more than 3 times
      if (error instanceof Error && error.message.includes('404')) return false;
      return failureCount < 3;
    }
  });

  useEffect(() => {
    if (progress?.status === 'complete' && onComplete) {
      onComplete();
    }
  }, [progress?.status, onComplete]);

  useEffect(() => {
    if (error && onError) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [error, onError]);

  // Adjust polling interval based on progress
  useEffect(() => {
    if (progress?.status === 'in_progress') {
      // Increase interval as progress increases
      const newInterval = Math.min(
        2000 + Math.floor((progress.current / progress.total) * 3000),
        5000
      );
      setPollInterval(newInterval);
    }
  }, [progress]);

  return {
    progress,
    error,
    isLoading,
    isComplete: progress?.status === 'complete',
    isFailed: progress?.status === 'failed',
    isPending: progress?.status === 'pending' || !progress,
    isInProgress: progress?.status === 'in_progress'
  };
} 