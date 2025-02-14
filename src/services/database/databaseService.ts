import dbConnect from '@/lib/mongoose';
import { Analysis, IAnalysis } from '@/models/Analysis';
import type { Repository } from '@/types/auth';
import type { AnalysisProgress, FileNode, Module } from '@/types';
import { userService } from './userService';

export class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect() {
    await dbConnect();
  }

  async getAnalysis(repositoryId: number): Promise<IAnalysis | null> {
    await this.connect();
    return Analysis.findOne({ 
      repositoryId,
      cacheExpiry: { $gt: new Date() }
    });
  }

  async saveAnalysis(data: {
    repositoryId: number;
    repository: Repository;
    githubId: number;
    files: FileNode[];
    modules: Module[];
    performanceMetrics: {
      analysisTime: number;
      apiCalls: number;
      memoryUsage: number;
    };
    analysisProgress: AnalysisProgress;
  }): Promise<IAnalysis> {
    await this.connect();
    
    // Get user's plan
    const user = await userService.getUser(data.githubId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const analysis = new Analysis({
      ...data,
      userPlan: user.plan,
      lastAnalyzed: new Date(),
      cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    return analysis.save();
  }

  async updateAnalysis(
    repositoryId: number,
    updates: Partial<IAnalysis>
  ): Promise<IAnalysis | null> {
    await this.connect();
    return Analysis.findOneAndUpdate(
      { repositoryId },
      { $set: updates },
      { new: true }
    );
  }

  async deleteAnalysis(repositoryId: number): Promise<boolean> {
    await this.connect();
    const result = await Analysis.deleteOne({ repositoryId });
    return result.deletedCount === 1;
  }

  async listAnalyses(page = 1, limit = 10): Promise<{
    analyses: IAnalysis[];
    total: number;
    pages: number;
  }> {
    await this.connect();
    const skip = (page - 1) * limit;
    
    const [analyses, total] = await Promise.all([
      Analysis.find()
        .sort({ lastAnalyzed: -1 })
        .skip(skip)
        .limit(limit),
      Analysis.countDocuments()
    ]);

    return {
      analyses,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  async cleanupExpiredAnalyses(): Promise<number> {
    await this.connect();
    const result = await Analysis.deleteMany({
      cacheExpiry: { $lt: new Date() }
    });
    return result.deletedCount;
  }

  async getAnalysisStats(): Promise<{
    totalAnalyses: number;
    averageFiles: number;
    averageModules: number;
    averageAnalysisTime: number;
  }> {
    await this.connect();
    const stats = await Analysis.aggregate([
      {
        $group: {
          _id: null,
          totalAnalyses: { $sum: 1 },
          averageFiles: { $avg: { $size: '$files' } },
          averageModules: { $avg: { $size: '$modules' } },
          averageAnalysisTime: { $avg: '$performanceMetrics.analysisTime' }
        }
      }
    ]);

    return stats[0] || {
      totalAnalyses: 0,
      averageFiles: 0,
      averageModules: 0,
      averageAnalysisTime: 0
    };
  }

  async getUserAnalysis(githubId: number, owner: string, repo: string): Promise<IAnalysis | null> {
    await this.connect();
    return Analysis.findOne({
      githubId,
      'repository.owner.login': owner,
      'repository.name': repo,
      cacheExpiry: { $gt: new Date() }
    });
  }

  async createAnalysis(data: {
    githubId: number;
    owner: string;
    repo: string;
  }): Promise<IAnalysis> {
    await this.connect();
    
    // Get user and their plan
    const user = await userService.getUser(data.githubId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const analysis = new Analysis({
      githubId: data.githubId,
      userPlan: user.plan,
      repository: {
        owner: { login: data.owner },
        name: data.repo
      },
      lastAnalyzed: new Date(),
      currentCommit: '',
      files: [],
      modules: [],
      performanceMetrics: {
        analysisTime: 0,
        apiCalls: 0,
        memoryUsage: 0,
        timestamp: new Date()
      },
      analysisProgress: {
        totalFiles: 0,
        analyzedFiles: 0,
        currentPhase: 'initializing',
        estimatedTimeRemaining: 0,
        status: 'in-progress',
        errors: []
      },
      cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    return analysis.save();
  }

  async getUserAnalyses(
    githubId: number,
    page = 1,
    limit = 10,
    status?: string
  ): Promise<{
    analyses: IAnalysis[];
    total: number;
    pages: number;
  }> {
    await this.connect();
    const skip = (page - 1) * limit;
    
    const query: any = { githubId };
    if (status) {
      query['analysisProgress.status'] = status;
    }
    
    const [analyses, total] = await Promise.all([
      Analysis.find(query)
        .sort({ lastAnalyzed: -1 })
        .skip(skip)
        .limit(limit),
      Analysis.countDocuments(query)
    ]);

    return {
      analyses,
      total,
      pages: Math.ceil(total / limit)
    };
  }
}

export const databaseService = DatabaseService.getInstance(); 