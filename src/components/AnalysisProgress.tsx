import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, GitBranch, GitCommit, GitMerge, Loader2 } from 'lucide-react';
import { ClientOnly } from './ClientOnly';
import type { AnalysisProgress as AnalysisProgressType } from '@/types';

interface AnalysisProgressProps {
  progress: AnalysisProgressType;
}

const phases = [
  { id: 'initializing', icon: GitBranch, label: 'Initializing Analysis' },
  { id: 'fetching-files', icon: FileText, label: 'Fetching Repository Files' },
  { id: 'analyzing-files', icon: GitCommit, label: 'Analyzing Code Structure' },
  { id: 'generating-modules', icon: GitMerge, label: 'Generating Module Graph' },
];

export function AnalysisProgress({ progress }: AnalysisProgressProps) {
  return (
    <ClientOnly>
      <AnalysisProgressContent progress={progress} />
    </ClientOnly>
  );
}

function AnalysisProgressContent({ progress }: AnalysisProgressProps) {
  const currentPhaseIndex = phases.findIndex(phase => phase.id === progress.currentPhase);

  const getProgressPercentage = () => {
    if (progress.totalFiles === 0) return 0;
    return Math.round((progress.analyzedFiles / progress.totalFiles) * 100);
  };

  const getEstimatedTimeString = () => {
    if (progress.estimatedTimeRemaining === 0) return 'Calculating...';
    const seconds = Math.round(progress.estimatedTimeRemaining / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  const getPhaseMessage = () => {
    switch (progress.currentPhase) {
      case 'initializing':
        return 'Initializing analysis...';
      case 'fetching-repository':
        return 'Fetching repository data...';
      case 'analyzing-files':
        return `Analyzing files (${progress.analyzedFiles}/${progress.totalFiles})`;
      case 'completed':
        return 'Analysis completed!';
      case 'error':
        return 'Analysis failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative"
      >
        <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-blue-700">
            {getProgressPercentage()}%
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2"
      >
        <h3 className="text-lg font-semibold text-gray-800">
          {getPhaseMessage()}
        </h3>
        {progress.currentPhase !== 'completed' && progress.currentPhase !== 'error' && (
          <p className="text-sm text-gray-600">
            Estimated time remaining: {getEstimatedTimeString()}
          </p>
        )}
        {progress.errors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">
              {progress.errors[0]}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
} 