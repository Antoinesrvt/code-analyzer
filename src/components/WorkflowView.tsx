import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRepository } from '@/contexts/repository/RepositoryContext';
import { WorkflowGraph } from '@/components/workflow/WorkflowGraph';
import { WorkflowSkeleton } from '@/components/workflow/WorkflowSkeleton';
import { ProgressBanner } from './ProgressBanner';

export function WorkflowView() {
  const { workflow, isLoading, selectedRepo, analysisProgress } = useRepository();

  // Don't render during SSR
  if (typeof window === 'undefined') {
    return <WorkflowSkeleton />;
  }

  return (
    <div className="w-full h-full relative">
      {/* Progress Banner */}
      <AnimatePresence>
        {analysisProgress && analysisProgress.status === 'in_progress' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-20"
          >
            <ProgressBanner progress={analysisProgress} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isLoading && !workflow.nodes.length ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WorkflowSkeleton />
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
            <WorkflowGraph
              nodes={workflow.nodes}
              edges={workflow.edges}
              analysisInProgress={analysisProgress?.status === 'in_progress'}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}