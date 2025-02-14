import { FileNode, Module } from '@/types';
import { performanceMonitor } from '@/services/monitoring/performanceService';
import { workflowMonitor } from '@/services/analysis/workflowMonitor';
import { githubService } from '@/services/github/githubService';

interface FileChange {
  path: string;
  changeType: 'added' | 'modified' | 'deleted';
  previousHash?: string;
  currentHash?: string;
  size?: number;
  modules: string[];
  dependencies: string[];
}

interface ModuleChange {
  moduleId: string;
  changeType: 'added' | 'modified' | 'deleted';
  affectedFiles: string[];
}

interface DifferentialAnalysis {
  commitHash: string;
  parentCommit: string;
  timestamp: Date;
  changes: FileChange[];
  moduleChanges: ModuleChange[];
  performanceMetrics: {
    analysisTime: number;
    apiCalls: number;
    memoryUsage: number;
  };
}

export class DifferentialService {
  private static instance: DifferentialService;

  private constructor() {}

  public static getInstance(): DifferentialService {
    if (!DifferentialService.instance) {
      DifferentialService.instance = new DifferentialService();
    }
    return DifferentialService.instance;
  }

  private compareFiles(oldFile: FileNode, newFile: FileNode): FileChange | null {
    if (!oldFile || !newFile) return null;

    // Check if file content has changed using hash comparison
    if (oldFile.id !== newFile.id) {
      return {
        path: newFile.path,
        changeType: 'modified',
        previousHash: oldFile.id,
        currentHash: newFile.id,
        size: newFile.size,
        modules: newFile.modules,
        dependencies: newFile.dependencies
      };
    }

    return null;
  }

  private compareModules(oldModule: Module, newModule: Module): ModuleChange | null {
    if (!oldModule || !newModule) return null;

    const affectedFiles: string[] = [];
    
    // Compare files in modules
    const oldFiles = new Set(oldModule.files.map(f => f.path));
    const newFiles = new Set(newModule.files.map(f => f.path));

    // Find modified or removed files
    oldModule.files.forEach(file => {
      const newFile = newModule.files.find(f => f.path === file.path);
      if (!newFile || this.compareFiles(file, newFile)) {
        affectedFiles.push(file.path);
      }
    });

    // Find added files
    newModule.files.forEach(file => {
      if (!oldFiles.has(file.path)) {
        affectedFiles.push(file.path);
      }
    });

    if (affectedFiles.length > 0) {
      return {
        moduleId: newModule.id,
        changeType: oldModule ? 'modified' : 'added',
        affectedFiles
      };
    }

    return null;
  }

  public async analyzeDifferential(
    owner: string,
    repo: string,
    currentCommit: string,
    previousCommit: string
  ): Promise<DifferentialAnalysis> {
    const operationId = `differential-analysis-${currentCommit}`;
    workflowMonitor.startOperation(operationId);
    performanceMonitor.startMonitoring();

    try {
      // Get file trees for both commits
      const [currentAnalysis, previousAnalysis] = await Promise.all([
        githubService.analyzeRepository(`https://github.com/${owner}/${repo}/tree/${currentCommit}`),
        githubService.analyzeRepository(`https://github.com/${owner}/${repo}/tree/${previousCommit}`)
      ]);

      const changes: FileChange[] = [];
      const moduleChanges: ModuleChange[] = [];

      // Create maps for efficient lookup
      const oldFileMap = new Map(previousAnalysis.files.map(f => [f.path, f]));
      const newFileMap = new Map(currentAnalysis.files.map(f => [f.path, f]));
      const oldModuleMap = new Map(previousAnalysis.modules.map(m => [m.id, m]));
      const newModuleMap = new Map(currentAnalysis.modules.map(m => [m.id, m]));

      // Find modified and deleted files
      oldFileMap.forEach((oldFile, path) => {
        const newFile = newFileMap.get(path);
        if (!newFile) {
          // File was deleted
          changes.push({
            path,
            changeType: 'deleted',
            previousHash: oldFile.id,
            size: 0,
            modules: [],
            dependencies: []
          });
        } else {
          // Check for modifications
          const change = this.compareFiles(oldFile, newFile);
          if (change) changes.push(change);
        }
      });

      // Find added files
      newFileMap.forEach((newFile, path) => {
        if (!oldFileMap.has(path)) {
          changes.push({
            path,
            changeType: 'added',
            currentHash: newFile.id,
            size: newFile.size,
            modules: newFile.modules,
            dependencies: newFile.dependencies
          });
        }
      });

      // Compare modules
      newModuleMap.forEach((newModule, id) => {
        const oldModule = oldModuleMap.get(id);
        const change = this.compareModules(oldModule, newModule);
        if (change) moduleChanges.push(change);
      });

      // Find deleted modules
      oldModuleMap.forEach((oldModule, id) => {
        if (!newModuleMap.has(id)) {
          moduleChanges.push({
            moduleId: id,
            changeType: 'deleted',
            affectedFiles: oldModule.files.map(f => f.path)
          });
        }
      });

      workflowMonitor.endOperation(operationId, 'success');
      const metrics = performanceMonitor.getMetrics();

      return {
        commitHash: currentCommit,
        parentCommit: previousCommit,
        timestamp: new Date(),
        changes,
        moduleChanges,
        performanceMetrics: {
          analysisTime: metrics.totalTime || 0,
          apiCalls: metrics.apiCalls || 0,
          memoryUsage: metrics.memoryUsage || 0
        }
      };
    } catch (error) {
      workflowMonitor.endOperation(operationId, 'error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}

export const differentialService = DifferentialService.getInstance(); 