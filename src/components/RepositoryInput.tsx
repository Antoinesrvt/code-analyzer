import React from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRepository } from '@/contexts/repository/RepositoryContext';
import { toast } from 'sonner';

export function RepositoryInput() {
  const [url, setUrl] = React.useState('');
  const [isValidating, setIsValidating] = React.useState(false);
  const router = useRouter();
  const { startAnalysis } = useRepository();

  const parseGitHubUrl = (input: string): { owner: string; repo: string } | null => {
    const trimmedInput = input.trim().replace(/\.git$/, '');
    const githubUrlPattern = /^(?:https?:\/\/github\.com\/)?([^/]+)\/([^/]+)$/;
    const match = trimmedInput.match(githubUrlPattern);
    
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      toast.error('Invalid repository URL', {
        description: 'Please use format: username/repo or https://github.com/username/repo',
      });
      return;
    }

    setIsValidating(true);
    try {
      await startAnalysis(parsed.owner, parsed.repo);
      router.push(`/analysis/${parsed.owner}/${parsed.repo}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid repository URL';
      toast.error('Analysis failed', {
        description: message,
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter GitHub repository URL..."
            className="w-full pl-10 h-12"
            disabled={isValidating}
          />
        </div>
        <Button type="submit" disabled={isValidating || !url.trim()}>
          Analyze
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Example: https://github.com/owner/repo
      </p>
    </form>
  );
}