import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Folder, Clock } from 'lucide-react';
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
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your repositories..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   transition-all duration-300"
        />
      </div>

      {/* Repository List */}
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {loading ? (
            <RepositoryListSkeleton />
          ) : error ? (
            <div className="text-center text-red-500 py-4">{error}</div>
          ) : repositories.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
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
    <motion.button
      onClick={() => onSelect(repository)}
      className="w-full text-left p-4 bg-white rounded-lg border border-gray-200
                hover:border-blue-500 hover:shadow-md transition-all duration-300
                focus:outline-none focus:ring-2 focus:ring-blue-500"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Folder className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium text-gray-900">{repository.name}</h3>
            {repository.isPrivate && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                Private
              </span>
            )}
          </div>
          {repository.description && (
            <p className="mt-1 text-sm text-gray-600">{repository.description}</p>
          )}
        </div>
      </div>
      
      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
        {repository.language && (
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{repository.language}</span>
          </span>
        )}
        <span className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>Updated {new Date(repository.updatedAt).toLocaleDateString()}</span>
        </span>
      </div>
    </motion.button>
  );
}

function RepositoryListSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-full h-24 bg-gray-100 rounded-lg animate-pulse"
        />
      ))}
    </>
  );
}