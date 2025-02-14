import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ClientOnly } from './ClientOnly';
import { useRepository } from '@/contexts/repository/RepositoryContext';
import type { AnalysisProgress as AnalysisProgressType } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

export function AnalysisProgress() {
  const { analysisProgress } = useRepository();

  if (!analysisProgress) return null;

  const getProgressPercentage = (progress: AnalysisProgressType) => {
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const percentage = getProgressPercentage(analysisProgress);

  return (
    <Card className="p-4 w-full max-w-xl mx-auto bg-background/60 backdrop-blur-sm border-muted">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm text-muted-foreground">{analysisProgress.message}</p>
        </div>
        <Progress value={percentage} className="h-2" />
        {analysisProgress.estimatedTimeRemaining && (
          <p className="text-xs text-muted-foreground text-right">
            Estimated time remaining: {Math.round(analysisProgress.estimatedTimeRemaining / 1000)}s
          </p>
        )}
        {analysisProgress.error && (
          <p className="text-xs text-destructive">
            Error: {analysisProgress.error}
          </p>
        )}
      </div>
    </Card>
  );
} 