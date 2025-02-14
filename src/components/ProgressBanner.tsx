import React from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';
import { AnalysisProgress } from '../types';

interface ProgressBannerProps {
  progress: AnalysisProgress;
}

export function ProgressBanner({ progress }: ProgressBannerProps) {
  const formatTime = (ms: number): string => {
    if (ms < 1000) return 'Less than a second';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  const getProgressPercentage = (): number => {
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {progress.status === "error" ? (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              ) : (
                <Clock className="w-5 h-5 text-blue-500" />
              )}
              <span className="font-medium text-gray-900">
                {progress.message}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {getProgressPercentage()}% complete
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {progress.estimatedTimeRemaining && (
              <div className="text-sm text-gray-500">
                Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}
              </div>
            )}
            <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${getProgressPercentage()}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900">
              {getProgressPercentage()}%
            </span>
          </div>
        </div>

        {progress.error && (
          <div className="mt-2 text-sm text-red-600">
            <div className="flex items-center space-x-1">
              <AlertTriangle className="w-4 h-4" />
              <span>{progress.error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}