import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, GitBranch, GitCommit, GitMerge, Loader2 } from 'lucide-react';
import type { AnalysisProgress } from '@/types';

interface AnalysisProgressProps {
  progress: AnalysisProgress;
}

const phases = [
  { id: 'initializing', icon: GitBranch, label: 'Initializing Analysis' },
  { id: 'fetching-files', icon: FileText, label: 'Fetching Repository Files' },
  { id: 'analyzing-files', icon: GitCommit, label: 'Analyzing Code Structure' },
  { id: 'generating-modules', icon: GitMerge, label: 'Generating Module Graph' },
];

export function AnalysisProgress({ progress }: AnalysisProgressProps) {
  const currentPhaseIndex = phases.findIndex(phase => phase.id === progress.currentPhase);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="relative mb-8">
        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 -translate-y-1/2" />
        <div
          className="absolute left-0 top-1/2 h-0.5 bg-blue-500 -translate-y-1/2 transition-all duration-500"
          style={{ width: `${((currentPhaseIndex + 1) / phases.length) * 100}%` }}
        />
        <div className="relative flex justify-between">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            const isComplete = index < currentPhaseIndex;
            const isCurrent = index === currentPhaseIndex;
            const isPending = index > currentPhaseIndex;

            return (
              <motion.div
                key={phase.id}
                className="relative flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 
                           ${isComplete ? 'bg-blue-500' : isCurrent ? 'bg-blue-100' : 'bg-gray-100'}`}
                  animate={{
                    scale: isCurrent ? [1, 1.1, 1] : 1,
                    transition: { duration: 1, repeat: Infinity }
                  }}
                >
                  <Icon className={`w-5 h-5 ${isComplete ? 'text-white' : isCurrent ? 'text-blue-500' : 'text-gray-400'}`} />
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-blue-500"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.5, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </motion.div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className={`text-sm font-medium 
                                ${isComplete ? 'text-blue-500' : 
                                  isCurrent ? 'text-gray-900' : 
                                  'text-gray-400'}`}>
                    {phase.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Progress Details */}
      <motion.div
        className="bg-white rounded-lg shadow-lg p-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Progress</h3>
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-500">
              {Math.round((progress.analyzedFiles / Math.max(progress.totalFiles, 1)) * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Files Analyzed</span>
              <span>{progress.analyzedFiles} / {progress.totalFiles}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${(progress.analyzedFiles / Math.max(progress.totalFiles, 1)) * 100}%`
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {progress.estimatedTimeRemaining > 0 && (
            <div className="text-sm text-gray-500">
              Estimated time remaining: {Math.ceil(progress.estimatedTimeRemaining / 1000)}s
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="mt-6">
          <AnimatePresence mode="popLayout">
            {progress.errors.map((error, index) => (
              <motion.div
                key={index}
                className="text-sm text-red-500 mb-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {error}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Analysis Tips */}
      <motion.div
        className="text-center text-sm text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p>Analyzing large repositories may take a few minutes.</p>
        <p>You can safely navigate away, we'll notify you when it's done.</p>
      </motion.div>
    </div>
  );
} 