import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, GitBranch, GitCommit, GitMerge, Loader2 } from 'lucide-react';
import { ClientOnly } from './ClientOnly';
import { useStore } from '@/store/useStore';
import { AnalysisProgress as AnalysisProgressType } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

export function AnalysisProgress() {
  const store = useStore();
  const analysisProgress = store().analysisProgress;

  if (!analysisProgress) return null;

  const getProgressPercentage = (progress: AnalysisProgressType) => {
    if (progress.totalFiles === 0) return 0;
    return Math.round((progress.analyzedFiles / progress.totalFiles) * 100);
  };

  const getProgressMessage = (progress: AnalysisProgressType) => {
    switch (progress.currentPhase) {
      case 'initializing':
        return 'Initializing analysis...';
      case 'fetching-repository':
        return 'Fetching repository data...';
      case 'analyzing-files':
        return `Analyzing files (${progress.analyzedFiles}/${progress.totalFiles})`;
      case 'completed':
        return 'Analysis complete!';
      case 'error':
        return `Error: ${progress.errors[0] || 'Unknown error'}`;
      default:
        return 'Processing...';
    }
  };

  const percentage = getProgressPercentage(analysisProgress);
  const message = getProgressMessage(analysisProgress);

  return (
    <Card className="p-4 w-full max-w-xl mx-auto bg-background/60 backdrop-blur-sm border-muted">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Progress value={percentage} className="h-2" />
        {analysisProgress.estimatedTimeRemaining && (
          <p className="text-xs text-muted-foreground text-right">
            Estimated time remaining: {Math.round(analysisProgress.estimatedTimeRemaining)}s
          </p>
        )}
      </div>
    </Card>
  );
} 