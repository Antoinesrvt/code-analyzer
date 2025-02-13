import { Octokit } from '@octokit/rest';
import type { FileNode, Module, AnalysisProgress } from '@/types';
import type { Repository, User } from '@/types/auth';
import { performanceMonitor } from './performanceService';
import { workflowMonitor } from './workflowMonitor';
import { authService } from './authService';
import { config } from '@/config/config';
import type { AnalyzedRepo } from '@/store/useAnalyzedReposStore';


const BATCH_SIZE = 10;

export class GitHubService {
  private octokit: Octokit | null = null;
  private static instance: GitHubService;
  private analysisProgress: AnalysisProgress = {
    totalFiles: 0,
    analyzedFiles: 0,
    currentPhase: 'initializing',
    estimatedTimeRemaining: 0,
    status: 'in-progress',
    errors: [],
  };

  private constructor() {
    // Initialize the service
    this.initializeClient();
  }

  private async initializeClient() {
    const authState = authService.getAuthState();
    if (authState.isAuthenticated) {
      try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        if (data.hasToken) {
          // Create a client that will use our API proxy
          this.octokit = new Octokit({
            baseUrl: '/api/github',
            request: {
              timeout: config.api.timeout
            }
          });
        }
      } catch (error) {
        console.error('Failed to initialize GitHub client:', error);
      }
    }
  }

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  private updateProgress(update: Partial<AnalysisProgress>) {
    this.analysisProgress = { ...this.analysisProgress, ...update };
    window.dispatchEvent(new CustomEvent('analysis-progress', { 
      detail: this.analysisProgress 
    }));
  }

  private calculateEstimatedTime(processed: number, total: number, startTime: number): number {
    if (processed === 0) return 0;
    const elapsed = performance.now() - startTime;
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
    if (!this.octokit) {
      const authState = authService.getAuthState();
      if (!authState.isAuthenticated) {
        throw new Error('Authentication required');
      }
      await this.initializeClient();
      if (!this.octokit) {
        throw new Error('Failed to initialize GitHub client');
      }
    }
    return this.octokit;
  }

  async analyzeRepository(url: string, onProgress?: (progress: AnalysisProgress) => void): Promise<AnalyzedRepo> {
    const operationId = 'analyze-repository';
    workflowMonitor.startOperation(operationId);
    
    try {
      const octokit = await this.ensureAuthenticated();
      performanceMonitor.startMonitoring();
      const startTime = performance.now();
      
      const { owner: ownerName, repo: repoName } = this.extractRepoInfo(url);
      
      this.analysisProgress = {
        totalFiles: 0,
        analyzedFiles: 0,
        currentPhase: 'fetching-repository',
        estimatedTimeRemaining: 0,
        status: 'in-progress',
        errors: [],
      };

      // Fetch repository data
      const { data: repoData } = await workflowMonitor.executeWithRetry(
        'fetch-repo-data',
        () => octokit.rest.repos.get({ owner: ownerName, repo: repoName }),
        { timeout: config.api.timeout }
      );

      const repoOwner: User = {
        id: repoData.owner.id,
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

      // Store metrics separately
      const metrics = performanceMonitor.getMetrics();
      const progress = { ...this.analysisProgress };

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