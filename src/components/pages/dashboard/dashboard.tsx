"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, History, Settings } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/auth/AuthContext";
import { useRepository } from "@/contexts/repository/RepositoryContext";
import { RepositorySelector } from "@/components/RepositorySelector";
import type { Repository } from "@/types/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Dashboard() {
  const router = useRouter();
  const { githubUser } = useAuth();
  const { analyzedRepos, selectRepository } = useRepository();
  const [showRepoSelector, setShowRepoSelector] = React.useState(false);

  const handleRepositorySelect = async (repo: Repository) => {
    setShowRepoSelector(false);
    await selectRepository(repo);
    router.push(`/analysis/${repo.owner.login}/${repo.name}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative w-10 h-10">
                <Image
                  src={githubUser?.avatarUrl || ""}
                  alt={githubUser?.login || "User avatar"}
                  fill
                  className="rounded-full object-cover"
                />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-semibold">
                  Welcome, {githubUser?.name || githubUser?.login}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage your repository analyses
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowRepoSelector(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Analyze Repository
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key="repos-list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {analyzedRepos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analyzedRepos.map((repo) => (
                  <Card
                    key={repo.url}
                    className="overflow-hidden hover:shadow-md transition-shadow duration-300"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-primary/10">
                            <GitBranch className="w-4 h-4 text-primary" />
                          </div>
                          <h3 className="ml-2 font-semibold">
                            {repo.name}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Settings"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {repo.description || "No description available"}
                      </p>
                      <div className="mt-4">
                        <div className="text-sm text-muted-foreground">
                          Last analyzed:{" "}
                          {new Date(repo.lastAnalyzed).toLocaleDateString()}
                        </div>
                        <div className="mt-2 flex items-center space-x-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                                       text-xs font-medium bg-primary/10 text-primary">
                            {repo.files.length} files
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                                       text-xs font-medium bg-green-100 text-green-800">
                            {repo.modules.length} modules
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-muted/50">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/analysis/${repo.owner.login}/${repo.name}`)}
                      >
                        View Analysis
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mx-auto">
                  <GitBranch className="w-8 h-8 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-medium">
                  No repositories analyzed yet
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start by analyzing your first repository to see insights and metrics.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => setShowRepoSelector(true)}
                >
                  Analyze Your First Repository
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Repository Selector Dialog */}
      <Dialog open={showRepoSelector} onOpenChange={setShowRepoSelector}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Repository</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <RepositorySelector onSelect={handleRepositorySelect} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
