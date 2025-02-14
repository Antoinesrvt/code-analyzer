"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleView } from "@/components/ModuleView";
import { WorkflowView } from "@/components/WorkflowView";
import { LoadingView } from "@/components/LoadingView";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import { githubService } from "@/services/githubService";
import { toast } from "sonner";
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
  Eye,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AnalysisPageProps {
  owner: string;
  repo: string;
}

export function AnalysisPage({ owner, repo }: AnalysisPageProps) {
  const [activeView, setActiveView] = React.useState<"module" | "workflow">("module");
  const router = useRouter();
  const store = useStore();
  const { loading, error, analysisProgress, repository, setLoading, setError, setAnalysisProgress, setRepository } = store();

  React.useEffect(() => {
    let mounted = true;
    let analysisTimeout: NodeJS.Timeout;

    const startAnalysis = async () => {
      if (!mounted) return;
      
      try {
        setLoading(true);
        setError(null);
        setAnalysisProgress({
          currentPhase: 'initializing',
          totalFiles: 0,
          analyzedFiles: 0,
          estimatedTimeRemaining: 0,
          status: 'in-progress',
          errors: []
        });
        
        // Set a timeout to prevent infinite loading
        analysisTimeout = setTimeout(() => {
          if (mounted) {
            setError('Analysis timeout - please try again');
            setLoading(false);
            setAnalysisProgress(null);
            toast.error('Analysis Timeout', {
              description: 'The analysis took too long to complete. Please try again.',
              duration: 5000,
            });
          }
        }, 300000); // 5 minutes timeout
        
        // First, ensure we have the complete repository data
        const completeRepo = await githubService.getRepositoryData(owner, repo);

        if (!mounted) return;

        // Start the analysis with progress updates and error handling
        const analyzedRepo = await githubService.analyzeRepository(
          completeRepo.cloneUrl,
          (progress) => {
            if (!mounted) return;
            setAnalysisProgress(progress);
            
            // Update loading state based on progress
            if (progress.status === 'complete') {
              setLoading(false);
              clearTimeout(analysisTimeout);
            } else if (progress.status === 'error') {
              setError(progress.errors[0] || 'Analysis failed');
              setLoading(false);
              clearTimeout(analysisTimeout);
            }
          },
          (error) => {
            if (!mounted) return;
            setError(error);
            setLoading(false);
            clearTimeout(analysisTimeout);
            toast.error('Analysis Error', {
              description: error,
              duration: 5000,
            });
          }
        );

        if (!mounted) return;

        setRepository(analyzedRepo);
        setAnalysisProgress(null);
        toast.success('Analysis completed!', {
          description: `Successfully analyzed ${repo}`,
        });
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : 'Failed to analyze repository';
        setError(message);
        setLoading(false);
        setAnalysisProgress(null);
        toast.error('Analysis failed', {
          description: message,
        });
      } finally {
        if (mounted) {
          clearTimeout(analysisTimeout);
        }
      }
    };

    startAnalysis();

    return () => {
      mounted = false;
      clearTimeout(analysisTimeout);
      // Clean up store state when unmounting
      setLoading(false);
      setError(null);
      setAnalysisProgress(null);
      setRepository(null);
    };
  }, [owner, repo, setLoading, setError, setAnalysisProgress, setRepository]);

  if (error) {
    return (
      <LoadingView
        onCancel={() => {
          router.push('/dashboard');
        }}
        onRetry={() => {
          setError(null);
          router.refresh();
        }}
        error={error}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container py-8">
        {repository && (
          <div className="space-y-8">
            {/* Repository Info */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <GitBranch className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold">{repository.name}</h1>
                    <p className="text-muted-foreground mt-1">
                      {repository.description || 'No description available'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                  >
                    <a
                      href={repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on GitHub"
                    >
                      <Code2 className="h-4 w-4" />
                    </a>
                  </Button>
                  {repository.isFork && (
                    <div className="p-2" title="Forked repository">
                      <GitFork className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Created {new Date(repository.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Updated {new Date(repository.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Languages className="h-4 w-4" />
                  <span>{repository.language || 'Multiple languages'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {repository.isPrivate ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span>{repository.isPrivate ? 'Private' : 'Public'}</span>
                </div>
              </div>
            </Card>

            {/* View Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 bg-muted rounded-lg">
                <Button
                  variant={activeView === "module" ? "secondary" : "ghost"}
                  className="gap-2"
                  onClick={() => setActiveView("module")}
                >
                  <Boxes className="h-4 w-4" />
                  Module View
                </Button>
                <Button
                  variant={activeView === "workflow" ? "secondary" : "ghost"}
                  className="gap-2"
                  onClick={() => setActiveView("workflow")}
                >
                  <GitGraph className="h-4 w-4" />
                  Workflow View
                </Button>
              </div>
            </div>

            {/* Analysis Content */}
            <Card className="p-6 min-h-[600px] relative">
              {/* Progress Overlay */}
              <AnimatePresence>
                {analysisProgress && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-0 z-20 p-4"
                  >
                    <AnalysisProgress />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* View Content */}
              <div className="h-full">
                {activeView === "module" ? <ModuleView /> : <WorkflowView />}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
} 