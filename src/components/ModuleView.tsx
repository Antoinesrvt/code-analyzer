import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { ModuleGraph } from './ModuleGraph';
import { ModuleSkeleton } from './ModuleSkeleton';
import { PerformanceReport } from './PerformanceReport';
import { ProgressBanner } from './ProgressBanner';
import { AnalysisProgress } from '../types';

export function ModuleView() {
  const { modules, files, loading, repository } = useStore();
  const [showPerformance, setShowPerformance] = React.useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  useEffect(() => {
    const handleProgress = (event: CustomEvent<AnalysisProgress>) => {
      setProgress(event.detail);
    };

    window.addEventListener('analysis-progress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('analysis-progress', handleProgress as EventListener);
    };
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    // Handle node click - show details in a sidebar
    console.log('Clicked node:', node);
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Progress Banner */}
      <AnimatePresence>
        {progress && progress.status === 'in-progress' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-20"
          >
            <ProgressBanner progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowPerformance(!showPerformance)}
          className="px-4 py-2 bg-white text-blue-600 rounded-md shadow-sm hover:bg-blue-50 
                   transition-colors duration-300 focus:outline-none focus:ring-2 
                   focus:ring-blue-500 focus:ring-offset-2"
        >
          {showPerformance ? 'Hide Performance' : 'Show Performance'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading && !modules.length ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ModuleSkeleton />
          </motion.div>
        ) : showPerformance && repository?.performanceMetrics ? (
          <motion.div
            key="performance"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full overflow-auto p-4"
          >
            <PerformanceReport metrics={repository.performanceMetrics} />
          </motion.div>
        ) : (
          <motion.div
            key="graph"
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ModuleGraph
              modules={modules}
              files={files}
              onNodeClick={handleNodeClick}
              analysisInProgress={progress?.status === 'in-progress'}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}