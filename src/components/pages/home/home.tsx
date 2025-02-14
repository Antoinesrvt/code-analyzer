"use client";

import React from "react";
import { GitBranch } from "lucide-react";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ModuleView } from "@/components/ModuleView";
import { WorkflowView } from "@/components/WorkflowView";
import { LandingHero } from "@/components/LandingHero";
import { LoadingView } from "@/components/LoadingView";
import { LoginButton } from "@/components/LoginButton";
import { useAuth } from "@/contexts/auth/AuthContext";
import { useRepository } from "@/contexts/repository/RepositoryContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [activeView, setActiveView] = React.useState<"module" | "workflow">("module");
  const { isAuthenticated, githubUser } = useAuth();
  const { selectedRepo, isLoading, error } = useRepository();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster
        position="bottom-center"
        expand={true}
        richColors
        closeButton
        duration={5000}
        visibleToasts={3}
        toastOptions={{
          style: { background: "white" },
          className: "border border-gray-200",
          descriptionClassName: "text-gray-500",
        }}
      />

      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <motion.div
              className="flex items-center space-x-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GitBranch className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                GitHub Code Analyzer
              </h1>
            </motion.div>

            <div className="flex items-center space-x-4">
              {selectedRepo && !isLoading && !error && (
                <motion.div
                  className="flex space-x-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    onClick={() => setActiveView("module")}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-300 ${
                      activeView === "module"
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Module View
                  </button>
                  <button
                    onClick={() => setActiveView("workflow")}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-300 ${
                      activeView === "workflow"
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Workflow View
                  </button>
                </motion.div>
              )}

              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <a
                    href="/dashboard"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             transition-colors duration-300"
                  >
                    Dashboard
                  </a>
                  {githubUser && (
                    <div className="relative w-8 h-8">
                      <Image
                        src={githubUser.avatarUrl}
                        alt={githubUser.login}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <LoginButton />
              )}
            </div>
          </div>
        </div>
      </header>
    {isAuthenticated && 
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            {!selectedRepo && !isLoading ? (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <LandingHero />
              </motion.div>
            ) : isLoading || error ? (
              <LoadingView
                onCancel={() => {
                  router.push("/");
                }}
                onRetry={() => {
                  router.refresh();
                }}
                error={error}
              />
            ) : (
              <motion.div
                key="visualization"
                className="h-[calc(100vh-12rem)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {activeView === "module" ? <ModuleView /> : <WorkflowView />}
              </motion.div>
            )}
          </AnimatePresence>
        </ErrorBoundary>
      </main>
    }
    </div>
  );
}
