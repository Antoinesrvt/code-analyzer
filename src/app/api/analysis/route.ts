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

    // Add shorter timeout for initial checks
    const checkTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new ApiError('timeout', 'Request timed out', 504)), 10000)
    );

    try {
      // Check for existing analysis with timeout
      const existingAnalysis = await Promise.race([
        databaseService.getUserAnalysis(session.githubId, data.owner, data.repo) as Promise<IAnalysis | null>,
        checkTimeout
      ]);

      if (existingAnalysis) {
        const status = (existingAnalysis as IAnalysis).analysisProgress?.status;
        
        // If analysis is already in progress, prevent duplicate requests
        if (status === 'analyzing') {
          return createApiResponse({
            id: (existingAnalysis as IAnalysis).id,
            status: status,
            message: 'Analysis already in progress',
            pollInterval: 2000
          }, 202);
        }
      }

      // Create new analysis with idle status
      const analysis = await databaseService.createAnalysis({
        githubId: session.githubId,
        owner: data.owner,
        repo: data.repo,
        analysisProgress: {
          status: 'idle' as AnalysisStatus,
          current: 0,
          total: 100,
          message: 'Initializing analysis...'
        }
      });

      // Start analysis in background with error handling
      let analysisStarted = false;
      const startAnalysis = async () => {
        try {
          if (analysisStarted) return;
          analysisStarted = true;
          
          await databaseService.processAnalysis(analysis.id, {
            onProgress: async (progress) => {
              console.log('Analysis progress:', progress);
            },
            onComplete: async (data) => {
              console.log('Analysis complete:', data);
            },
            onError: async (error) => {
              console.error('Analysis error:', error);
              // Update analysis status to error
              await databaseService.updateAnalysis(analysis.id, {
                analysisProgress: {
                  status: 'error',
                  current: 0,
                  total: 100,
                  message: 'Analysis failed',
                  error: error.message
                }
              });
            }
          });
        } catch (error) {
          console.error('Failed to start analysis:', error);
          // Update analysis status to error
          await databaseService.updateAnalysis(analysis.id, {
            analysisProgress: {
              status: 'error',
              current: 0,
              total: 100,
              message: 'Failed to start analysis',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      };

      // Start analysis without waiting
      startAnalysis().catch(console.error);

      return createApiResponse({
        id: analysis.id,
        status: 'idle',
        message: 'Analysis started',
        pollInterval: 2000
      }, 202);

    } catch (error) {
      if (error instanceof ApiError && error.code === 'timeout') {
        return createErrorResponse(error);
      }
      throw error;
    }

  } catch (error) {
    console.error('Failed to create analysis:', error);
    return createErrorResponse(
      new ApiError('creation_failed', 'Failed to create analysis', 400)
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