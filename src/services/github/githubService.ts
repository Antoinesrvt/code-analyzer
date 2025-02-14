import { Octokit } from '@octokit/rest';
import type { FileNode, Module, AnalysisProgress, AnalysisStatus } from '@/types';
import type { Repository, User } from '@/types/auth';
import type { AnalysisPerformanceMetrics } from '@/types/performance';
import { performanceMonitor } from '../monitoring/performanceService';
import { workflowMonitor } from '../analysis/workflowMonitor';
import { config } from '@/config/config';

// Helper function to get current time in milliseconds safely
const getTimeMs = () => {
  if (typeof window === 'undefined') return Date.now();
  return performance?.now?.() ?? Date.now();
};

const BATCH_SIZE = 10;

const defaultAnalysisProgress: AnalysisProgress = {
  status: 'idle' as AnalysisStatus,
  current: 0,
  total: 100,
  message: 'Initializing analysis...'
};

// Use the existing type from RepositoryContext
export interface AnalyzedRepo extends Repository {
  lastAnalyzed: string;
  files: FileNode[];
  modules: Module[];
  performanceMetrics?: AnalysisPerformanceMetrics;
  analysisProgress?: AnalysisProgress;
}

export class GitHubService {
  private octokit: Octokit | null = null;
  private static instance: GitHubService | null = null;
  private analysisProgress: AnalysisProgress;
  private initialized: boolean = false;
  private currentProgressCallback: ((progress: AnalysisProgress) => void) | null = null;
  private currentErrorCallback: ((error: string) => void) | null = null;

  private constructor() {
    this.analysisProgress = { ...defaultAnalysisProgress };
    if (typeof window !== 'undefined') {
      this.initializeClient().catch(error => {
        console.error('Failed to initialize GitHub client:', error);
        this.initialized = false;
        this.octokit = null;
        if (this.currentErrorCallback) {
          this.currentErrorCallback('Failed to initialize GitHub client');
        }
      });
    }
  }

  public static getInstance(): GitHubService {
    if (typeof window === 'undefined') {
      // Return a dummy instance for SSR that does nothing
      const dummyInstance = new GitHubService();
      dummyInstance.initialized = true; // Prevent initialization attempts
      return dummyInstance;
    }

    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  private async initializeClient() {
    if (this.initialized || typeof window === 'undefined') return;
    
    try {
      const response = await fetch('/api/auth/status');
      if (!response.ok) {
        throw new Error(`Auth status check failed: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.hasToken) {
        this.octokit = new Octokit({
          baseUrl: '/api/github',
          request: {
            timeout: config.api.timeout
          }
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize GitHub client:', error);
      this.initialized = false;
      this.octokit = null;
      throw error; // Re-throw to handle in constructor
    }
  }

  private updateProgress(update: Partial<AnalysisProgress>) {
    this.analysisProgress = {
      ...this.analysisProgress,
      ...update
    };

    if (this.currentProgressCallback) {
      this.currentProgressCallback(this.analysisProgress);
    }
  }

  private calculateEstimatedTime(processed: number, total: number, startTime: number): number {
    if (processed === 0) return 0;
    const elapsed = getTimeMs() - startTime;
    const averageTimePerItem = elapsed / processed;
    return Math.round(averageTimePerItem * (total - processed));
  }

  private extractRepoInfo(url: string): { owner: string; repo: string } {
    // Remove any trailing slashes and .git extension
    const cleanUrl = url.replace(/\.git\/?$/, '').replace(/\/$/, '');
    
    // Handle both full URLs and shorthand format
    const matches = cleanUrl.match(/(?:https?:\/\/github\.com\/)?([^\/]+)\/([^\/]+)/);
    if (!matches) {
      throw new Error('Invalid GitHub repository URL format');
    }
    
    const [, owner, repo] = matches;
    return { owner, repo };
  }

  private async *getFilesProgressively(
    owner: string,
    repo: string,
    path: string = ''
  ): AsyncGenerator<FileNode[], void, unknown> {
    try {
      const octokit = await this.ensureAuthenticated();
      let page = 1;
      let hasMore = true;
      let totalFiles = 0;

      while (hasMore) {
        // Update progress with current status
        this.updateProgress({
          status: 'analyzing',
          message: `Fetching files from ${path || 'root'}...`,
          current: totalFiles,
          total: Math.max(totalFiles, page * BATCH_SIZE) // Estimate total
        });

        const response = await octokit.repos.getContent({
          owner,
          repo,
          path,
          per_page: BATCH_SIZE,
          page,
        });

        const data = Array.isArray(response.data) ? response.data : [response.data];
        
        if (data.length === 0) {
          hasMore = false;
          continue;
        }

        // Process files
        const files: FileNode[] = [];
        for (const item of data) {
          const node: FileNode = {
            id: item.sha,
            path: item.path,
            type: item.type === 'dir' ? 'directory' : 'file',
            size: item.size,
            modules: [],
            dependencies: [],
            analysisStatus: 'idle'
          };

          if (item.type === 'dir') {
            this.updateProgress({
              status: 'analyzing',
              message: `Analyzing directory: ${item.path}`,
              current: totalFiles,
              total: Math.max(totalFiles, page * BATCH_SIZE)
            });

            const subFilesGenerator = this.getFilesProgressively(owner, repo, item.path);
            for await (const subFiles of subFilesGenerator) {
              node.children = subFiles;
              files.push(...subFiles);
            }
          } else {
            files.push(node);
          }

          totalFiles++;
        }

        yield files;
        page++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress({
        status: 'error',
        message: `Failed to fetch files: ${errorMessage}`,
        error: errorMessage
      });
      throw error;
    }
  }

  private async analyzeModulesProgressively(files: FileNode[]): Promise<Module[]> {
    const operationId = 'analyze-modules';
    workflowMonitor.startOperation(operationId);
    
    try {
      const modules: Module[] = [];
      const moduleMap = new Map<string, FileNode[]>();

      // Process files in batches for module analysis
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batchOperationId = `analyze-modules-batch-${i}`;
        workflowMonitor.startOperation(batchOperationId);
        
        try {
          const batch = files.slice(i, i + BATCH_SIZE);
          
          batch.forEach(file => {
            if (file.type === 'file') {
              const patterns = [
                { regex: /\.service\.(ts|js)x?$/, module: 'Services' },
                { regex: /\.component\.(ts|js)x?$/, module: 'Components' },
                { regex: /\.model\.(ts|js)x?$/, module: 'Models' },
                { regex: /\.util\.(ts|js)x?$/, module: 'Utilities' },
              ];

              patterns.forEach(({ regex, module }) => {
                if (regex.test(file.path)) {
                  const moduleFiles = moduleMap.get(module) || [];
                  moduleFiles.push(file);
                  moduleMap.set(module, moduleFiles);
                  file.modules.push(module);
                }
              });
            }
          });

          workflowMonitor.endOperation(batchOperationId, 'success');
        } catch (error) {
          workflowMonitor.endOperation(batchOperationId, 'error',
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        }
      }

      moduleMap.forEach((moduleFiles, moduleName) => {
        modules.push({
          id: moduleName.toLowerCase(),
          name: moduleName,
          files: moduleFiles,
          metrics: {
            totalFiles: moduleFiles.length,
            totalSize: moduleFiles.reduce((sum, file) => sum + file.size, 0),
            complexity: 1,
          },
          analysisStatus: 'complete',
        });
      });

      workflowMonitor.endOperation(operationId, 'success');
      return modules;
    } catch (error) {
      workflowMonitor.endOperation(operationId, 'error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  private async ensureAuthenticated(): Promise<Octokit> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot authenticate in server environment');
    }

    if (!this.initialized) {
      await this.initializeClient();
    }

    if (!this.octokit) {
      throw new Error('GitHub client not initialized. Please ensure you are authenticated.');
    }

    return this.octokit;
  }

  public async getRepositoryData(owner: string, repo: string): Promise<Repository> {
    const octokit = await this.ensureAuthenticated();
    const { data: repoData } = await workflowMonitor.executeWithRetry(
      'fetch-repo-data',
      () => octokit.rest.repos.get({ owner, repo }),
      { timeout: config.api.timeout }
    );

    const repoOwner: User = {
      id: repoData.owner.id,
      email: repoData.owner.email || null,
      login: repoData.owner.login,
      name: repoData.owner.name || null,
      avatarUrl: repoData.owner.avatar_url,
      url: repoData.owner.url,
      type: repoData.owner.type as 'User' | 'Organization',
    };

    return {
      id: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description || '',
      owner: repoOwner,
      url: repoData.html_url,
      gitUrl: repoData.git_url,
      sshUrl: repoData.ssh_url,
      cloneUrl: repoData.clone_url,
      defaultBranch: repoData.default_branch,
      visibility: repoData.visibility as 'public' | 'private' | 'internal',
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
      isPrivate: repoData.private,
      isFork: repoData.fork,
      permissions: {
        admin: repoData.permissions?.admin || false,
        maintain: repoData.permissions?.maintain,
        push: repoData.permissions?.push || false,
        triage: repoData.permissions?.triage,
        pull: repoData.permissions?.pull || false,
      },
      topics: repoData.topics || [],
      language: repoData.language,
      size: repoData.size,
    };
  }

  public async analyzeRepository(
    url: string,
    onProgress?: (progress: AnalysisProgress) => void,
    onError?: (error: string) => void
  ): Promise<AnalyzedRepo> {
    const startTime = getTimeMs();
    
    try {
      this.currentProgressCallback = onProgress || null;
      this.currentErrorCallback = onError || null;
      
      // Reset progress
      this.updateProgress({
        status: 'idle',
        message: 'Initializing analysis...',
        current: 0,
        total: 100
      });

      const { owner, repo } = this.extractRepoInfo(url);
      
      // Update progress for repository fetch
      this.updateProgress({
        status: 'analyzing',
        message: 'Fetching repository data...',
        current: 0,
        total: 100
      });

      const repository = await this.getRepositoryData(owner, repo);
      const processedFiles: FileNode[] = [];
      
      // Process files progressively
      const filesGenerator = this.getFilesProgressively(owner, repo);
      for await (const files of filesGenerator) {
        processedFiles.push(...files);
        
        // Update progress with file analysis status
        const progress = Math.min(Math.round((processedFiles.length / (processedFiles.length + 10)) * 100), 95);
        this.updateProgress({
          status: 'analyzing',
          message: `Processing files (${processedFiles.length} found)...`,
          current: progress,
          total: 100,
          estimatedTimeRemaining: this.calculateEstimatedTime(
            progress,
            100,
            startTime
          )
        });
      }

      // Update final progress
      this.updateProgress({
        status: 'complete',
        message: 'Analysis completed successfully',
        current: 100,
        total: 100,
        completedAt: new Date()
      });

      return {
        ...repository,
        lastAnalyzed: new Date().toISOString(),
        files: processedFiles,
        modules: await this.analyzeModulesProgressively(processedFiles),
        analysisProgress: this.analysisProgress
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress({
        status: 'error',
        message: `Analysis failed: ${errorMessage}`,
        error: errorMessage
      });
      throw error;
    }
  }
}

// Export singleton instance
export const githubService = GitHubService.getInstance();