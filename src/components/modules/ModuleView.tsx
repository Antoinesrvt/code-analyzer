import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRepository } from '@/contexts/repository/RepositoryContext';
import { GraphNode, ModuleGraph } from './ModuleGraph';
import { ModuleSkeleton } from './ModuleSkeleton';
import { PerformanceReport } from '../PerformanceReport';
import { AnalysisProgress } from '../states/AnalysisProgress';

export function ModuleView() {
  const { modules, files, isLoading, selectedRepo, analysisProgress } = useRepository();
  const [showPerformance, setShowPerformance] = React.useState(false);

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Handle node click - show details in a sidebar
    console.log('Clicked node:', node);
  }, []);

  // Don't render during SSR
  if (typeof window === 'undefined') {
    return <ModuleSkeleton />;
  }

  return (
    <div className="w-full h-full relative">
      {/* Progress Indicator */}
      <AnimatePresence>
        {analysisProgress && analysisProgress.status === "analyzing" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-20"
          >
            <AnalysisProgress />
          {/* <ProgressBanner progress={analysisProgress} /> */}
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
          {showPerformance ? "Hide Performance" : "Show Performance"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading && !modules.length ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ModuleSkeleton />
          </motion.div>
        ) : showPerformance && selectedRepo?.performanceMetrics ? (
          <motion.div
            key="performance"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full overflow-auto p-4"
          >
            <PerformanceReport metrics={selectedRepo.performanceMetrics} />
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
              analysisInProgress={analysisProgress?.status === "analyzing"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}