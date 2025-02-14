import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Folder, Clock, Lock, Globe } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Repository } from '../types/auth';
import { authService } from '../services/authService';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from 'sonner';
import type { SearchReposParameters } from '../types/github';

interface RepositorySelectorProps {
  onSelect: (repo: Repository) => void;
}

export function RepositorySelector({ onSelect }: RepositorySelectorProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const repos = debouncedSearch
          ? await authService.searchRepositories({ 
              q: `${debouncedSearch} in:name fork:true`,
              sort: 'updated',
              order: 'desc'
            } as SearchReposParameters)
          : await authService.getUserRepositories();
        
        setRepositories(repos);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch repositories';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();
  }, [debouncedSearch]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your repositories..."
            className="w-full pl-10 h-12 bg-background/60 backdrop-blur-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {loading ? (
            <RepositoryListSkeleton />
          ) : error ? (
            <div className="text-center text-destructive py-4">{error}</div>
          ) : repositories.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No repositories found
            </div>
          ) : (
            repositories.map((repo) => (
              <RepositoryCard
                key={repo.id}
                repository={repo}
                onSelect={onSelect}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RepositoryCard({ repository, onSelect }: { repository: Repository; onSelect: (repo: Repository) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card 
        className="group hover:shadow-md transition-all duration-300 bg-background/60 backdrop-blur-sm 
                 border-muted hover:border-primary/20 cursor-pointer"
        onClick={() => onSelect(repository)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{repository.name}</h3>
                <p className="text-sm text-muted-foreground">{repository.owner.login}</p>
              </div>
            </div>
            {repository.isPrivate ? (
              <Lock className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Globe className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        
        {repository.description && (
          <>
            <Separator className="opacity-50" />
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {repository.description}
              </p>
            </CardContent>
          </>
        )}

        <CardFooter className="pt-3">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            {repository.language && (
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>{repository.language}</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4" />
              <span>Updated {new Date(repository.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function RepositoryListSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="w-full h-[140px] animate-pulse">
          <div className="h-full bg-muted/50" />
        </Card>
      ))}
    </>
  );
}