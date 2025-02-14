import { NextRequest } from 'next/server';
import { z } from 'zod';
import { differentialService } from '@/services/analysis/differentialService';
import { Analysis } from '@/models/Analysis';
import { 
  createApiResponse, 
  createErrorResponse, 
  createUnauthorizedResponse,
  ApiError 
} from '../../utils/apiResponse';
import { withValidation } from '../../utils/validateRequest';

// Validation schemas
const createDiffSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  currentCommit: z.string().min(1, 'Current commit hash is required'),
  previousCommit: z.string().min(1, 'Previous commit hash is required'),
});

const getDiffSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  commit: z.string().min(1, 'Commit hash is required'),
});

export const POST = withValidation(createDiffSchema, async (data, request: NextRequest) => {
  try {
    // Get the existing analysis or create a new one
    const analysis = await Analysis.findOne({
      'repository.owner.login': data.owner,
      'repository.name': data.repo
    });

    if (!analysis) {
      throw new ApiError('not_found', 'Repository analysis not found', 404);
    }

    // Check user plan limits
    if (analysis.historicalAnalyses.length >= analysis.retentionPolicy.maxHistoryCount) {
      throw new ApiError(
        'plan_limit_exceeded',
        'Historical analysis limit reached',
        403,
        {
          plan: analysis.userPlan,
          limit: analysis.retentionPolicy.maxHistoryCount
        }
      );
    }

    // Perform differential analysis
    const differentialAnalysis = await differentialService.analyzeDifferential(
      data.owner,
      data.repo,
      data.currentCommit,
      data.previousCommit
    );

    // Update the analysis with the new differential data
    analysis.historicalAnalyses.push(differentialAnalysis);
    await analysis.pruneHistory();

    return createApiResponse(differentialAnalysis);
  } catch (error) {
    console.error('Differential analysis error:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError(
        'differential_analysis_failed',
        'Failed to perform differential analysis',
        500,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      )
    );
  }
});

export const GET = withValidation(getDiffSchema, async (data, request: NextRequest) => {
  try {
    const analysis = await Analysis.findOne({
      'repository.owner.login': data.owner,
      'repository.name': data.repo
    });

    if (!analysis) {
      throw new ApiError('not_found', 'Repository analysis not found', 404);
    }

    const historicalAnalysis = await analysis.getHistoricalAnalysis(data.commit);
    
    if (!historicalAnalysis) {
      throw new ApiError('not_found', 'Historical analysis not found for this commit', 404);
    }

    return createApiResponse(historicalAnalysis);
  } catch (error) {
    console.error('Failed to fetch historical analysis:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError(
        'fetch_failed',
        'Failed to fetch historical analysis',
        500
      )
    );
  }
});

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
      ].join(', '),
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
} 