import React from 'react';
import { motion } from 'framer-motion';

export function WorkflowSkeleton() {
  return (
    <div className="w-full h-full min-h-[600px] bg-background/40 backdrop-blur-sm rounded-lg p-4">
      <div className="w-full h-full flex items-center justify-center">
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Simulated nodes */}
          <div className="flex gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-32 h-16 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
          {/* Simulated edges */}
          <div className="flex gap-4 justify-center">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="w-24 h-1 rounded-full bg-muted animate-pulse"
              />
            ))}
          </div>
          {/* More simulated nodes */}
          <div className="flex gap-4 justify-end">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="w-32 h-16 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
} 