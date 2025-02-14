"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, History, Settings, X } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { useAnalyzedReposStore } from "@/store/useAnalyzedReposStore";
import { RepositorySelector } from "@/components/RepositorySelector";
import { AnalysisPage } from "@/components/pages/analysis/AnalysisPage";
import type { Repository } from "@/types/auth";

export default function Dashboard() {
  const store = useAuthStore();
  const { user } = store();
  const analyzedReposStore = useAnalyzedReposStore();
  const { analyzedRepos } = analyzedReposStore();
  const [showRepoSelector, setShowRepoSelector] = React.useState(false);
  const [selectedRepo, setSelectedRepo] = React.useState<Repository | null>(null);

  const handleRepositorySelect = (repo: Repository) => {
    setSelectedRepo(repo);
    setShowRepoSelector(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative w-10 h-10">
                <Image
                  src={user?.avatarUrl || ""}
                  alt={user?.login || "User avatar"}
                  fill
                  className="rounded-full object-cover"
                />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Welcome, {user?.name || user?.login}
                </h1>
                <p className="text-sm text-gray-500">
                  Manage your repository analyses
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRepoSelector(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors duration-300"
            >
              <Plus className="w-5 h-5 mr-2" />
              Analyze Repository
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {selectedRepo ? (
            <motion.div
              key="analysis"
              className="bg-white rounded-lg shadow-lg p-6 min-h-[600px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <GitBranch className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedRepo.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedRepo(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full
                           hover:bg-gray-100 transition-colors duration-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <AnalysisPage
                repository={selectedRepo}
                onClose={() => setSelectedRepo(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="repos-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {analyzedRepos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {analyzedRepos.map((repo) => (
                    <motion.div
                      key={repo.url}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center">
                            <GitBranch className="w-5 h-5 text-blue-600" />
                            <h3 className="ml-2 text-lg font-medium text-gray-900">
                              {repo.name}
                            </h3>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              title="View History"
                              className="p-2 text-gray-400 hover:text-gray-600 rounded-full
                                     hover:bg-gray-100 transition-colors duration-300"
                            >
                              <History className="w-5 h-5" />
                            </button>
                            <button
                              title="Settings"
                              className="p-2 text-gray-400 hover:text-gray-600 rounded-full
                                     hover:bg-gray-100 transition-colors duration-300"
                            >
                              <Settings className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          {repo.description || "No description available"}
                        </p>
                        <div className="mt-4">
                          <div className="text-sm text-gray-500">
                            Last analyzed:{" "}
                            {new Date(repo.lastAnalyzed).toLocaleDateString()}
                          </div>
                          <div className="mt-2 flex items-center space-x-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                                         text-xs font-medium bg-blue-100 text-blue-800">
                              {repo.files.length} files
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                                         text-xs font-medium bg-green-100 text-green-800">
                              {repo.modules.length} modules
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
                        <button
                          onClick={() => setSelectedRepo(repo)}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md
                                   text-sm font-medium text-gray-700 hover:bg-gray-50
                                   focus:outline-none focus:ring-2 focus:ring-offset-2
                                   focus:ring-blue-500 transition-colors duration-300"
                        >
                          View Analysis
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <GitBranch className="w-12 h-12 mx-auto text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    No repositories analyzed yet
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Start by analyzing your first repository to see insights and
                    metrics.
                  </p>
                  <button
                    onClick={() => setShowRepoSelector(true)}
                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg
                             hover:bg-blue-700 transition-colors duration-300"
                  >
                    Analyze Your First Repository
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Repository Selector Modal */}
      <AnimatePresence>
        {showRepoSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Select Repository
                  </h2>
                  <button
                    onClick={() => setShowRepoSelector(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <RepositorySelector onSelect={handleRepositorySelect} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
