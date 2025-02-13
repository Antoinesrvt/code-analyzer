import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, GitBranch, FileSearch, Network, Code2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LoadingViewProps {
  onCancel: () => void;
  onRetry: () => void;
  error?: string | null;
}

const loadingSteps = [
  {
    icon: GitBranch,
    title: 'Connecting to Repository',
    description: 'Establishing secure connection to GitHub...',
  },
  {
    icon: FileSearch,
    title: 'Analyzing Files',
    description: 'Scanning repository structure and contents...',
  },
  {
    icon: Code2,
    title: 'Processing Code',
    description: 'Identifying patterns and relationships...',
  },
  {
    icon: Network,
    title: 'Building Graph',
    description: 'Generating visualization data...',
  },
];

const tips = [
  'Did you know? The first version of Git was released in 2005 by Linus Torvalds.',
  'Code visualization can help identify potential bottlenecks and improve architecture.',
  'Repository analysis helps teams understand code dependencies and maintain cleaner codebases.',
  'Modern static analysis can detect potential bugs before they reach production.',
];

export function LoadingView({ onCancel, onRetry, error }: LoadingViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    // Progress simulation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 300);

    // Step progression
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 3000);

    // Tip rotation
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 5000);

    // Timeout warning
    const timeoutTimer = setTimeout(() => {
      if (!error) {
        setShowTimeout(true);
        toast.warning('This is taking longer than expected. Would you like to continue waiting?', {
          duration: Infinity,
          action: {
            label: 'Cancel',
            onClick: onCancel,
          },
        });
      }
    }, 30000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(tipInterval);
      clearTimeout(timeoutTimer);
    };
  }, [onCancel, error]);

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center justify-center min-h-[400px] p-8"
      >
        <div className="text-center max-w-md">
          <div className="mb-6 text-red-500">
            <AlertCircle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Analysis Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                       transition-colors duration-300 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 
                       transition-colors duration-300 focus:outline-none focus:ring-2 
                       focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-2xl mx-auto p-8"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Analyzing Repository</h2>
        <p className="text-gray-600">Please wait while we process your repository</p>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-100 rounded-full mb-8 overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full bg-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-6 mb-12">
        {loadingSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center space-x-4 ${
                isActive ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <div className="flex-shrink-0">
                {isActive ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-medium">{step.title}</h3>
                <p className={`text-sm ${isActive ? 'text-blue-500' : 'text-gray-500'}`}>
                  {step.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-blue-50 rounded-lg p-6 text-blue-700"
      >
        <h4 className="font-medium mb-2">Did you know?</h4>
        <motion.p
          key={currentTip}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-blue-600"
        >
          {tips[currentTip]}
        </motion.p>
      </motion.div>

      {showTimeout && (
        <div className="mt-8 text-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 
                     transition-colors duration-300 focus:outline-none focus:ring-2 
                     focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel Analysis
          </button>
        </div>
      )}
    </motion.div>
  );
}