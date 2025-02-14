import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleView } from "@/components/ModuleView";
import { WorkflowView } from "@/components/WorkflowView";
import { LoadingView } from "@/components/LoadingView";
import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import type { Repository } from "@/types/auth";
import { githubService } from "@/services/githubService";
import { toast } from "sonner";

interface AnalysisPageProps {
  repository: Repository;
  onClose: () => void;
}

export function AnalysisPage({ repository, onClose }: AnalysisPageProps) {
  const [activeView, setActiveView] = React.useState<"module" | "workflow">("module");
  const store = useStore();
  const { loading, error } = store();
  const router = useRouter();

  React.useEffect(() => {
    const startAnalysis = async () => {
      try {
        const analyzedRepo = await githubService.analyzeRepository(repository.cloneUrl);
        store().setRepository(analyzedRepo);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to analyze repository';
        store().setError(message);
        toast.error('Analysis failed', {
          description: message,
        });
      }
    };

    startAnalysis();
  }, [repository]);

  return (
    <div className="h-full">
      {/* View Toggle */}
      {!loading && !error && (
        <motion.div
          className="mb-4 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex space-x-4 bg-white rounded-lg shadow-sm p-1">
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
          </div>
        </motion.div>
      )}

      {/* Content */}
      <div className="h-[calc(100%-4rem)]">
        <AnimatePresence mode="wait">
          {loading || error ? (
            <LoadingView
              onCancel={() => {
                store().setLoading(false);
                store().setError(null);
                onClose();
              }}
              onRetry={() => {
                store().setError(null);
                router.refresh();
              }}
              error={error}
            />
          ) : (
            <motion.div
              key="visualization"
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeView === "module" ? <ModuleView /> : <WorkflowView />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 