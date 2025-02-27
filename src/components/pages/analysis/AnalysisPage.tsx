"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleView } from "@/components/modules/ModuleView";
import { WorkflowView } from "@/components/WorkflowView";
import { LoadingView } from "@/components/states/LoadingView";
import { useRepository } from "@/contexts/repository/RepositoryContext";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/contexts/auth/AuthContext";

interface AnalysisPageProps {
  owner: string;
  repo: string;
}

export function AnalysisPage({ owner, repo }: AnalysisPageProps) {
  const [activeView, setActiveView] = React.useState<"module" | "workflow">("module");
  const router = useRouter();
  const { dbUser } = useAuth();
  const { 
    isLoading, 
    error, 
    analysisProgress, 
    selectedRepo,
    analyzedRepos,
    startAnalysis,
    clearAnalysis
  } = useRepository();

  React.useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    const analyze = async () => {
      if (!mounted) return;
      
      try {
        // Check plan limits
        if (dbUser) {
          const maxRepos = dbUser.plan === 'basic' ? 1 : dbUser.plan === 'standard' ? 3 : Infinity;
          if (analyzedRepos.length >= maxRepos) {
            toast.error('Plan limit reached', {
              description: `Your ${dbUser.plan} plan allows ${maxRepos} ${maxRepos === 1 ? 'repository' : 'repositories'}. Please upgrade to analyze more.`,
            });
            router.push('/dashboard');
            return;
          }
        }

        await startAnalysis(owner, repo);
      } catch (error) {
        if (!mounted) return;
        
        const message = error instanceof Error ? error.message : 'Failed to analyze repository';
        
        // Show different message for resource errors
        if (message.includes('ERR_INSUFFICIENT_RESOURCES')) {
          toast.error('Resource limit reached', {
            description: 'Please try again in a few minutes or analyze a smaller repository.',
            duration: 10000,
          });
        } else {
          toast.error('Analysis failed', {
            description: message,
          });
        }
        
        // Auto-redirect on fatal errors
        retryTimeout = setTimeout(() => {
          if (mounted) {
            clearAnalysis();
            router.push('/dashboard');
          }
        }, 5000);
      }
    };

    analyze();

    return () => {
      mounted = false;
      clearTimeout(retryTimeout);
      clearAnalysis();
    };
  }, [owner, repo, startAnalysis, clearAnalysis, dbUser, analyzedRepos.length, router]);

  // Show loading view while analysis is in progress
  if (isLoading || (analysisProgress && analysisProgress.status !== 'complete')) {
    return (
      <LoadingView
        onCancel={() => {
          clearAnalysis();
          router.push('/dashboard');
        }}
        onRetry={() => {
          router.refresh();
        }}
        error={error?.message}
      />
    );
  }

  // Show error view if analysis failed
  if (error || !selectedRepo) {
    return (
      <LoadingView
        onCancel={() => {
          clearAnalysis();
          router.push('/dashboard');
        }}
        onRetry={() => {
          router.refresh();
        }}
        error={error?.message || 'Failed to load repository'}
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
            onClick={() => {
              clearAnalysis();
              router.push('/dashboard');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="space-y-8">
          {/* Repository Info */}
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <GitBranch className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">{selectedRepo.name}</h1>
                  <p className="text-muted-foreground mt-1">
                    {selectedRepo.description || 'No description available'}
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
                    href={selectedRepo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on GitHub"
                  >
                    <Code2 className="h-4 w-4" />
                  </a>
                </Button>
                {selectedRepo.isFork && (
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
                <span>Created {new Date(selectedRepo.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Updated {new Date(selectedRepo.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Languages className="h-4 w-4" />
                <span>{selectedRepo.language || 'Multiple languages'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {selectedRepo.isPrivate ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span>{selectedRepo.isPrivate ? 'Private' : 'Public'}</span>
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
          <Card className="p-6 min-h-[600px]">
            <div className="h-full">
              {activeView === "module" ? <ModuleView /> : <WorkflowView />}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
} 