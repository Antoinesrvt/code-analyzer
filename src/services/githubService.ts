import { Octokit } from '@octokit/rest';
import type { FileNode, Module, AnalysisProgress } from '@/types';
import type { Repository, User } from '@/types/auth';
import { performanceMonitor } from './performanceService';
import { workflowMonitor } from './workflowMonitor';
import { config } from '@/config/config';
import type { AnalyzedRepo } from '@/store/useAnalyzedReposStore';
import { updateAnalysisProgress } from '@/store/useStore';

// Helper function to get current time in milliseconds safely
const getTimeMs = () => {
  if (typeof window === 'undefined') return Date.now();
  return performance?.now?.() ?? Date.now();
};

const BATCH_SIZE = 10;

const defaultAnalysisProgress: AnalysisProgress = {
  totalFiles: 0,
  analyzedFiles: 0,
  currentPhase: 'initializing',
  estimatedTimeRemaining: 0,
  status: 'in-progress',
  errors: [],
};

class GitHubService {
  private octokit: Octokit | null = null;
  private static instance: GitHubService | null = null;
  private analysisProgress: AnalysisProgress;
  private initialized: boolean = false;

  private constructor() {
    this.analysisProgress = { ...defaultAnalysisProgress };
    // Only initialize if we're on the client side
    if (typeof window !== 'undefined') {
      this.initializeClient();
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
    }
  }

  private updateProgress(update: Partial<AnalysisProgress>) {
    if (typeof window === 'undefined') return;
    
    this.analysisProgress = { ...this.analysisProgress, ...update };
    // Only update store on client side
    updateAnalysisProgress(this.analysisProgress);
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
    const operationId = `fetch-files-${path || 'root'}`;
    
    try {
      const octokit = await this.ensureAuthenticated();
      workflowMonitor.startOperation(operationId);
      
      const { data } = await workflowMonitor.executeWithRetry(
        `api-call-${operationId}`,
        () => octokit.rest.repos.getContent({ owner, repo, path }),
        { timeout: config.api.timeout }
      );

      if (!Array.isArray(data)) {
        throw new Error('Invalid repository path');
      }

      this.updateProgress({
        totalFiles: this.analysisProgress.totalFiles + data.length,
      });

      const files: FileNode[] = [];
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batchOperationId = `process-batch-${path}-${i}`;
        workflowMonitor.startOperation(batchOperationId);
        
        try {
          const batch = data.slice(i, i + BATCH_SIZE);
          const batchFiles = await Promise.all(
            batch.map(async (item) => {
              const fileNode: FileNode = {
                id: item.sha,
                path: item.path,
                type: item.type === 'dir' ? 'directory' : 'file',
                size: item.size,
                modules: [],
                dependencies: [],
                analysisStatus: 'pending',
              };

              if (item.type === 'dir') {
                const subFilesGenerator = this.getFilesProgressively(owner, repo, item.path);
                for await (const subFiles of subFilesGenerator) {
                  fileNode.children = subFiles;
                  fileNode.analysisStatus = 'complete';
                }
              } else {
                fileNode.analysisStatus = 'complete';
              }

              return fileNode;
            })
          );

          files.push(...batchFiles);
          workflowMonitor.endOperation(batchOperationId, 'success');
          yield batchFiles;
        } catch (error) {
          workflowMonitor.endOperation(batchOperationId, 'error', 
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        }
      }

      workflowMonitor.endOperation(operationId, 'success');
    } catch (error) {
      workflowMonitor.endOperation(operationId, 'error',
        error instanceof Error ? error : new Error(String(error))
      );
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred while fetching files';

      this.updateProgress({
        status: 'error',
        currentPhase: 'error',
        errors: [...this.analysisProgress.errors, errorMessage],
      });

      console.error('Failed to fetch files:', error);
      throw new Error(errorMessage);
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

  public async analyzeRepository(url: string, onProgress?: (progress: AnalysisProgress) => void): Promise<AnalyzedRepo> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot analyze repository during SSR');
    }

    const operationId = 'analyze-repository';
    workflowMonitor.startOperation(operationId);
    
    try {
      const octokit = await this.ensureAuthenticated();
      performanceMonitor.startMonitoring();
      const startTime = getTimeMs();
      
      const { owner: ownerName, repo: repoName } = this.extractRepoInfo(url);
      
      this.analysisProgress = { ...defaultAnalysisProgress };
      this.updateProgress(this.analysisProgress);

      // Fetch repository data
      const { data: repoData } = await workflowMonitor.executeWithRetry(
        'fetch-repo-data',
        () => octokit.rest.repos.get({ owner: ownerName, repo: repoName }),
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

      const repository: Repository = {
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

      this.updateProgress({
        currentPhase: 'analyzing-files',
        status: 'in-progress',
      });

      const fileAnalysisStream = this.getFilesProgressively(ownerName, repoName);
      const modules: Module[] = [];
      let processedFiles: FileNode[] = [];

      for await (const batch of fileAnalysisStream) {
        processedFiles = [...processedFiles, ...batch];
        
        this.updateProgress({
          analyzedFiles: processedFiles.length,
          estimatedTimeRemaining: this.calculateEstimatedTime(
            processedFiles.length,
            this.analysisProgress.totalFiles,
            startTime
          ),
        });

        const newModules = await this.analyzeModulesProgressively(batch);
        modules.push(...newModules);
        
        if (onProgress) {
          onProgress(this.analysisProgress);
        }
      }

      this.updateProgress({
        currentPhase: 'completed',
        status: 'complete',
        estimatedTimeRemaining: 0,
      });

      workflowMonitor.endOperation(operationId, 'success');
      workflowMonitor.logMetrics();
      
      const analyzedRepo: AnalyzedRepo = {
        ...repository,
        lastAnalyzed: new Date().toISOString(),
        files: processedFiles,
        modules: modules,
        performanceMetrics: performanceMonitor.getMetrics(),
        analysisProgress: this.analysisProgress,
      };

      return analyzedRepo;
    } catch (error) {
      workflowMonitor.endOperation(operationId, 'error',
        error instanceof Error ? error : new Error(String(error))
      );
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred while analyzing repository';

      this.updateProgress({
        status: 'error',
        currentPhase: 'error',
        errors: [...this.analysisProgress.errors, errorMessage],
      });

      console.error('Failed to analyze repository:', error);
      throw new Error(errorMessage);
    }
  }
}

// Export singleton instance
export const githubService = GitHubService.getInstance();