import mongoose, { Schema, Document } from 'mongoose';
import type { FileNode, Module, AnalysisProgress } from '../types';
import type { Repository } from '../types/auth';
import type { PerformanceMetrics } from '../types/performance';

// User Plan Types
export enum UserPlan {
  BASIC = 'basic',    // Latest analysis only
  STANDARD = 'standard', // Last 3 analyses
  PREMIUM = 'premium'  // Unlimited analyses
}

// Sub-schemas
const FileNodeSchema = new Schema({
  id: { type: String, required: true },
  path: { type: String, required: true },
  type: { type: String, enum: ['file', 'directory'], required: true },
  size: { type: Number, required: true },
  modules: [{ type: String }],
  dependencies: [{ type: String }],
  children: [{ type: Schema.Types.Mixed }], // Recursive reference
  analysisStatus: { 
    type: String, 
    enum: ['pending', 'in-progress', 'complete', 'error'],
    required: true 
  }
});

// File Change Schema for differential storage
const FileChangeSchema = new Schema({
  path: { type: String, required: true },
  changeType: { 
    type: String, 
    enum: ['added', 'modified', 'deleted'], 
    required: true 
  },
  previousHash: String,
  currentHash: String,
  size: Number,
  modules: [String],
  dependencies: [String]
});

const ModuleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  files: [FileNodeSchema],
  metrics: {
    totalFiles: { type: Number, required: true },
    totalSize: { type: Number, required: true },
    complexity: { type: Number, required: true }
  },
  analysisStatus: { 
    type: String, 
    enum: ['pending', 'in-progress', 'complete', 'error'],
    required: true 
  }
});

const PerformanceMetricsSchema = new Schema({
  analysisTime: { type: Number, required: true },
  apiCalls: { type: Number, required: true },
  memoryUsage: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const AnalysisProgressSchema = new Schema({
  totalFiles: { type: Number, required: true },
  analyzedFiles: { type: Number, required: true },
  currentPhase: { 
    type: String, 
    enum: ['initializing', 'fetching-repository', 'analyzing-files', 'completed', 'error'],
    required: true 
  },
  estimatedTimeRemaining: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['in-progress', 'complete', 'error'],
    required: true 
  },
  errors: [{ type: String }]
});

// Commit Analysis Schema for storing differences
const CommitAnalysisSchema = new Schema({
  commitHash: { type: String, required: true, index: true },
  parentCommit: { type: String, index: true },
  timestamp: { type: Date, required: true },
  changes: [FileChangeSchema],
  moduleChanges: [{
    moduleId: String,
    changeType: { 
      type: String, 
      enum: ['added', 'modified', 'deleted'] 
    },
    affectedFiles: [String]
  }],
  performanceMetrics: {
    analysisTime: Number,
    apiCalls: Number,
    memoryUsage: Number
  }
});

// Main Analysis Schema
export interface IAnalysis extends Document {
  repositoryId: number;
  repository: Repository;
  githubId: number;  // Changed from userId to githubId
  userPlan: UserPlan;
  lastAnalyzed: Date;
  currentCommit: string;
  files: FileNode[];
  modules: Module[];
  performanceMetrics: {
    analysisTime: number;
    apiCalls: number;
    memoryUsage: number;
    timestamp: Date;
  };
  analysisProgress: AnalysisProgress;
  historicalAnalyses: typeof CommitAnalysisSchema[];
  retentionPolicy: {
    keepUntil: Date;
    maxHistoryCount: number;
  };
  cacheExpiry: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isExpired(): boolean;
  getHistoricalAnalysis(commitHash: string): Promise<typeof CommitAnalysisSchema | null>;
  pruneHistory(): Promise<void>;
}

const AnalysisSchema = new Schema<IAnalysis>(
  {
    repositoryId: { type: Number, required: true, index: true },
    repository: { type: Schema.Types.Mixed, required: true },
    githubId: { type: Number, required: true, index: true, ref: 'User' }, // Changed from userId to githubId with ref
    userPlan: { 
      type: String, 
      enum: Object.values(UserPlan),
      required: true,
      default: UserPlan.BASIC
    },
    lastAnalyzed: { type: Date, required: true },
    currentCommit: { type: String, required: true },
    files: [FileNodeSchema],
    modules: [ModuleSchema],
    performanceMetrics: { type: PerformanceMetricsSchema, required: true },
    analysisProgress: { type: AnalysisProgressSchema, required: true },
    historicalAnalyses: [CommitAnalysisSchema],
    retentionPolicy: {
      keepUntil: { type: Date },
      maxHistoryCount: { 
        type: Number,
        default: function() {
          switch (this.userPlan) {
            case UserPlan.BASIC: return 1;
            case UserPlan.STANDARD: return 3;
            case UserPlan.PREMIUM: return Number.MAX_SAFE_INTEGER;
            default: return 1;
          }
        }
      }
    },
    cacheExpiry: { type: Date, required: true },
    version: { type: Number, required: true, default: 1 }
  },
  {
    timestamps: true,
    collection: 'analyses'
  }
);

// Indexes
AnalysisSchema.index({ repositoryId: 1, lastAnalyzed: -1 });
AnalysisSchema.index({ cacheExpiry: 1 }, { expireAfterSeconds: 0 });
AnalysisSchema.index({ githubId: 1, repositoryId: 1 }, { unique: true }); // Updated from userId to githubId
AnalysisSchema.index({ 'historicalAnalyses.commitHash': 1 });

// Methods
AnalysisSchema.methods.isExpired = function(): boolean {
  return this.cacheExpiry < new Date();
};

AnalysisSchema.methods.getHistoricalAnalysis = async function(commitHash: string) {
  return this.historicalAnalyses.find(ha => ha.commitHash === commitHash) || null;
};

AnalysisSchema.methods.pruneHistory = async function() {
  if (this.historicalAnalyses.length > this.retentionPolicy.maxHistoryCount) {
    // Keep the most recent analyses based on plan
    this.historicalAnalyses = this.historicalAnalyses
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, this.retentionPolicy.maxHistoryCount);
    await this.save();
  }
};

// Middleware
AnalysisSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set default cache expiry
    this.cacheExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Set retention policy based on plan
    switch (this.userPlan) {
      case UserPlan.BASIC:
        this.retentionPolicy.maxHistoryCount = 1;
        break;
      case UserPlan.STANDARD:
        this.retentionPolicy.maxHistoryCount = 3;
        break;
      case UserPlan.PREMIUM:
        this.retentionPolicy.maxHistoryCount = Number.MAX_SAFE_INTEGER;
        break;
    }
  }
  next();
});

// GDPR compliance: Cascade delete user data
AnalysisSchema.pre('deleteOne', { document: true, query: false }, async function() {
  // Clean up any associated data
  // This is where you'd add any additional cleanup needed for GDPR compliance
});

// Export the model
export const Analysis = mongoose.models.Analysis || mongoose.model<IAnalysis>('Analysis', AnalysisSchema); 