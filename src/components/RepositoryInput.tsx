import React, { useState, useCallback } from 'react';
import { Search, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { githubService } from '../services/githubService';
import { useAnalyzedReposStore } from '../store/useAnalyzedReposStore';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import type { AnalysisProgress } from '../types';
import type { Repository } from '@/types/auth';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export function RepositoryInput() {
  const [url, setUrl] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setRepository, setLoading, setError } = useStore();

  const validateUrl = (input: string): boolean => {
    const trimmedInput = input.trim().replace(/\.git$/, '');
    const githubUrlPattern = /^(?:https?:\/\/github\.com\/)?[\w-]+\/[\w.-]+$/;
    return githubUrlPattern.test(trimmedInput);
  };

  const debouncedValidation = useDebouncedCallback((value: string) => {
    if (value.trim()) {
      const isValidUrl = validateUrl(value);
      setIsValid(isValidUrl);
      
      if (!isValidUrl) {
        toast.error('Invalid repository URL format', {
          description: 'Please use format: username/repo or https://github.com/username/repo',
        });
      }
    } else {
      setIsValid(null);
    }
  }, 300);

  React.useEffect(() => {
    debouncedValidation(url);
  }, [url, debouncedValidation]);

  const formatUrl = (input: string): string => {
    const trimmed = input.trim().replace(/\.git$/, '');
    if (trimmed.startsWith('http')) {
      return trimmed;
    }
    return `https://github.com/${trimmed}`;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim() || !isValid) {
      toast.error('Please enter a valid GitHub repository URL');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);
    setError(null);

    const formattedUrl = formatUrl(url);
    let retryCount = 0;

    const handleProgress = (progress: AnalysisProgress) => {
      if (progress.analyzedFiles > 0 && progress.currentPhase === 'analyzing-files') {
        setLoading(false);
      }

      if (progress.estimatedTimeRemaining > 30000) {
        toast.warning('This is taking longer than expected', {
          duration: Infinity,
          action: {
            label: 'Cancel',
            onClick: () => {
              setIsSubmitting(false);
              setLoading(false);
              setError('Analysis cancelled by user');
            },
          },
        });
      }
    };

    const attemptAnalysis = async (): Promise<void> => {
      try {
        const repo = await githubService.analyzeRepository(formattedUrl, handleProgress);
        setRepository(repo);
        useAnalyzedReposStore.getState().addAnalyzedRepo(repo);
        setIsSubmitting(false);
        setLoading(false);
      } catch (error) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          toast.error(`Analysis failed, retrying (${retryCount}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return attemptAnalysis();
        }
        
        const message = error instanceof Error ? error.message : 'Failed to analyze repository';
        setError(message);
        setIsSubmitting(false);
        setLoading(false);
        toast.error(message);
      }
    };

    attemptAnalysis();
  }, [url, isValid, setRepository, setLoading, setError]);

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="relative group">
        <div className="relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter GitHub repository URL or username/repo"
            className={`w-full px-4 py-3 pr-24 text-gray-900 border rounded-lg 
                     transition-all duration-300 text-base
                     placeholder:text-gray-400
                     disabled:bg-gray-50 disabled:cursor-not-allowed
                     group-hover:border-gray-300
                     ${
                       isValid === true
                         ? 'border-green-500 focus:ring-green-200'
                         : isValid === false
                         ? 'border-red-500 focus:ring-red-200'
                         : 'border-gray-200 focus:ring-blue-200'
                     }
                     focus:ring-2 focus:ring-opacity-50 focus:border-transparent`}
            disabled={isSubmitting}
            aria-label="Repository URL"
            aria-invalid={isValid === false}
            aria-describedby="url-validation"
          />
          <AnimatePresence mode="wait">
            {url && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-12 top-1/2 -translate-y-1/2"
              >
                {isValid === true ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : isValid === false ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 
                   hover:text-gray-700 transition-colors duration-300
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
          aria-label={isSubmitting ? 'Analyzing repository...' : 'Analyze repository'}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </button>
      </div>
      <div id="url-validation" className="mt-2 text-sm text-center">
        {isValid === false ? (
          <p className="text-red-500">
            Please enter a valid GitHub repository (e.g., username/repo or full URL)
          </p>
        ) : (
          <p className="text-gray-500">
            Enter a GitHub repository URL or use the format username/repo
          </p>
        )}
      </div>
    </motion.form>
  );
}