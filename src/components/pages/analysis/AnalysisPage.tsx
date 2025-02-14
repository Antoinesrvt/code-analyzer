import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleView } from "@/components/ModuleView";
import { WorkflowView } from "@/components/WorkflowView";
import { LoadingView } from "@/components/LoadingView";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import type { Repository } from "@/types/auth";
import { githubService } from "@/services/githubService";
import { toast } from "sonner";
import { ClientOnly } from "@/components/ClientOnly";
import { 
  Boxes, 
  GitBranch, 
  GitGraph, 
  FileText, 
  Code2, 
  GitFork,
  Calendar,
  Clock,
  Languages,
  Lock,
  Eye
} from "lucide-react";

interface AnalysisPageProps {
  repository: Repository;
  onClose: () => void;
}

const statsContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const statsItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function AnalysisPage({ repository, onClose }: AnalysisPageProps) {
  const [activeView, setActiveView] = React.useState<"module" | "workflow">("module");
  const router = useRouter();

  return (
    <ClientOnly>
      <AnalysisPageContent repository={repository} onClose={onClose} activeView={activeView} setActiveView={setActiveView} router={router} />
    </ClientOnly>
  );
}

function AnalysisPageContent({ 
  repository, 
  onClose, 
  activeView, 
  setActiveView,
  router 
}: AnalysisPageProps & { 
  activeView: "module" | "workflow";
  setActiveView: (view: "module" | "workflow") => void;
  router: ReturnType<typeof useRouter>;
}) {
  const store = useStore();
  const { loading, error, analysisProgress } = store();

  React.useEffect(() => {
    const startAnalysis = async () => {
      try {
        store().setLoading(true);
        store().setError(null);
        
        // First, ensure we have the complete repository data
        const completeRepo = await githubService.getRepositoryData(
          repository.owner.login,
          repository.name
        );

        // Start the analysis with progress updates
        const analyzedRepo = await githubService.analyzeRepository(
          completeRepo.cloneUrl,
          (progress) => {
            store().setAnalysisProgress(progress);
            
            // Update loading state based on progress
            if (progress.status === 'complete') {
              store().setLoading(false);
            } else if (progress.status === 'error') {
              store().setError(progress.errors[0] || 'Analysis failed');
              store().setLoading(false);
            }
          }
        );

        store().setRepository(analyzedRepo);
        store().setAnalysisProgress(null); // Clear progress when done
        toast.success('Analysis completed!', {
          description: `Successfully analyzed ${repository.name}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to analyze repository';
        store().setError(message);
        store().setLoading(false);
        store().setAnalysisProgress(null);
        toast.error('Analysis failed', {
          description: message,
        });
      }
    };

    startAnalysis();
  }, [repository]);

  return (
    <div className="h-full">
      {/* Repository Info */}
      <motion.div
        className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <GitBranch className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{repository.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{repository.description || 'No description available'}</p>
              
              {/* Repository Stats */}
              <motion.div 
                className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                variants={statsContainerVariants}
                initial="hidden"
                animate="show"
              >
                <motion.div 
                  variants={statsItemVariants}
                  className="flex items-center space-x-2 text-sm text-gray-600"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Created {new Date(repository.createdAt).toLocaleDateString()}</span>
                </motion.div>
                <motion.div 
                  variants={statsItemVariants}
                  className="flex items-center space-x-2 text-sm text-gray-600"
                >
                  <Clock className="w-4 h-4" />
                  <span>Last updated {new Date(repository.updatedAt).toLocaleDateString()}</span>
                </motion.div>
                <motion.div 
                  variants={statsItemVariants}
                  className="flex items-center space-x-2 text-sm text-gray-600"
                >
                  <Languages className="w-4 h-4" />
                  <span>{repository.language || 'Multiple languages'}</span>
                </motion.div>
                <motion.div 
                  variants={statsItemVariants}
                  className="flex items-center space-x-2 text-sm text-gray-600"
                >
                  {repository.visibility === 'private' ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span className="capitalize">{repository.visibility}</span>
                </motion.div>
              </motion.div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <a
              href={repository.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-white 
                       transition-colors duration-200"
            >
              <Code2 className="w-5 h-5" />
            </a>
            {repository.isFork && (
              <div className="p-2 text-gray-500" title="Forked repository">
                <GitFork className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Analysis Progress or Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full"
          >
            <AnalysisProgress progress={analysisProgress || {
              currentPhase: 'initializing',
              totalFiles: 0,
              analyzedFiles: 0,
              estimatedTimeRemaining: 0,
              status: 'in-progress',
              errors: [],
            }} />
          </motion.div>
        ) : error ? (
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
            key="content"
            className="h-full space-y-6"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.2
                }
              }
            }}
          >
            {/* View Toggle */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: -20 },
                show: { opacity: 1, y: 0 }
              }}
              className="flex justify-center"
            >
              <div className="p-1 bg-gray-100 rounded-lg inline-flex space-x-2">
                <button
                  onClick={() => setActiveView("module")}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-md transition-all duration-300
                           ${activeView === "module"
                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200"
                      : "text-gray-600 hover:bg-white/50"}`}
                >
                  <Boxes className="w-5 h-5" />
                  <span>Module View</span>
                </button>
                <button
                  onClick={() => setActiveView("workflow")}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-md transition-all duration-300
                           ${activeView === "workflow"
                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200"
                      : "text-gray-600 hover:bg-white/50"}`}
                >
                  <GitGraph className="w-5 h-5" />
                  <span>Workflow View</span>
                </button>
              </div>
            </motion.div>

            {/* View Content */}
            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.95 },
                show: { opacity: 1, scale: 1 }
              }}
              className="h-[calc(100%-8rem)] bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 h-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeView}
                    initial={{ opacity: 0, x: activeView === "module" ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: activeView === "module" ? 20 : -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    {activeView === "module" ? <ModuleView /> : <WorkflowView />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 