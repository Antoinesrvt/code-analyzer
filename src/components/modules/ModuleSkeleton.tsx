import React from 'react';
import { motion } from 'framer-motion';

export function ModuleSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        className="flex flex-col items-center space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-300 to-gray-400 animate-pulse" />
          </div>
        </div>
        <div className="space-y-4 w-64">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </motion.div>
    </div>
  );
}