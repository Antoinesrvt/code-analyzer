import { NextRequest } from 'next/server';
import { z } from 'zod';
import { databaseService } from '@/services/database/databaseService';
import { decryptSession } from '@/app/api/auth/[...nextauth]/route';
import { UserPlan, Analysis, IAnalysis } from '@/models/Analysis';
import { withValidation } from '../utils/validateRequest';
import { 
  createApiResponse, 
  createErrorResponse, 
  createUnauthorizedResponse,
  ApiError 
} from '../utils/apiResponse';
import type { AnalysisStatus } from '@/types';

// Validation schemas
const getAnalysisSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  status: z.enum(['pending', 'in_progress', 'complete', 'failed']).optional(),
});

const createAnalysisSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
});

const deleteAnalysisSchema = z.object({
  repositoryId: z.coerce.number().int().positive('Repository ID is required'),
});

export const GET = withValidation(getAnalysisSchema, async (data, request: NextRequest) => {
  try {
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse();
    }

    const session = decryptSession(sessionCookie.value);
    const result = await databaseService.getUserAnalyses(
      session.githubId,
      data.page,
      data.limit,
      data.status
    );
    
    return createApiResponse(result);
  } catch (error) {
    console.error('Failed to fetch analyses:', error);
    return createErrorResponse(
      new ApiError('fetch_failed', 'Failed to fetch analyses')
    );
  }
});

export const POST = withValidation(createAnalysisSchema, async (data, request: NextRequest) => {
  try {
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse();
    }

    const session = decryptSession(sessionCookie.value);

    // Add timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      // Check for existing analysis first (with shorter timeout)
      const existingAnalysis = await Promise.race([
        databaseService.getUserAnalysis(
          session.githubId,
          data.owner,
          data.repo
        ) as Promise<IAnalysis | null>,
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('DB lookup timeout')), 5000)
        )
      ]);

      // Check if there's a valid existing analysis
      if (existingAnalysis) {
        const status = existingAnalysis.analysisProgress?.status;
        
        // Return existing analysis if it's complete and not expired
        if (status === 'complete' && !existingAnalysis.isExpired()) {
          clearTimeout(timeoutId);
          return createApiResponse(existingAnalysis);
        }
        
        // If analysis is in progress, return current progress
        if (status === 'in_progress' || status === 'pending') {
          clearTimeout(timeoutId);
          return createApiResponse({
            id: existingAnalysis.id,
            status: status,
            progress: existingAnalysis.analysisProgress,
            pollInterval: 2000
          }, 202);
        }
      }

      // Create new analysis with pending status
      const analysis = await databaseService.createAnalysis({
        githubId: session.githubId,
        owner: data.owner,
        repo: data.repo,
        analysisProgress: {
          status: 'pending' as AnalysisStatus,
          current: 0,
          total: 100,
          message: 'Initializing analysis...'
        }
      });

      // Start analysis in the background without waiting
      databaseService.processAnalysis(analysis.id).catch(error => {
        console.error('Background analysis failed:', error);
      });

      clearTimeout(timeoutId);
      
      // Return immediately with the pending analysis
      return createApiResponse({
        id: analysis.id,
        status: 'pending',
        message: 'Analysis started',
        pollInterval: 2000
      }, 202);

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.error('Failed to create analysis:', error);
    return createErrorResponse(
      new ApiError('creation_failed', 'Failed to create analysis')
    );
  }
});

export const DELETE = withValidation(deleteAnalysisSchema, async (data, request: NextRequest) => {
  try {
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse();
    }

    const success = await databaseService.deleteAnalysis(data.repositoryId);
    if (!success) {
      return createErrorResponse(
        new ApiError('not_found', 'Analysis not found', 404)
      );
    }

    return createApiResponse({ success: true });
  } catch (error) {
    console.error('Failed to delete analysis:', error);
    return createErrorResponse(
      new ApiError('deletion_failed', 'Failed to delete analysis')
    );
  }
});

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
} 