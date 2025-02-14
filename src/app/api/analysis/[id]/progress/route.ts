// src/app/api/analysis/[id]/progress/route.ts
import { NextRequest } from "next/server";
import { z } from 'zod';
import { Analysis } from "@/models/Analysis";
import { decryptSession } from "@/app/api/auth/[...nextauth]/route";
import type { AnalysisProgress } from "@/types";
import { 
  createApiResponse, 
  createErrorResponse, 
  createUnauthorizedResponse,
  ApiError 
} from '../../../utils/apiResponse';
import { withValidation } from '../../../utils/validateRequest';

// Validation schemas
const routeParamsSchema = z.object({
  id: z.string().min(1, 'Analysis ID is required'),
});

const progressSchema = z.object({
  progress: z.object({
    status: z.enum(['pending', 'in_progress', 'complete', 'failed']),
    current: z.number().min(0),
    total: z.number().min(0),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  performanceMetrics: z.object({
    codeSize: z.number().optional(),
    complexity: z.number().optional(),
    dependencies: z.number().optional(),
    testCoverage: z.number().optional(),
    timestamp: z.date().optional(),
  }).optional(),
});

export const PATCH = withValidation(
  progressSchema.merge(routeParamsSchema),
  async (data, request: NextRequest) => {
    try {
      // Verify user session
      const sessionCookie = request.cookies.get("gh_session");
      if (!sessionCookie?.value) {
        return createUnauthorizedResponse();
      }

      const session = decryptSession(sessionCookie.value);

      // Find and update analysis
      const analysis = await Analysis.findById(data.id);
      if (!analysis) {
        throw new ApiError('not_found', 'Analysis not found', 404);
      }

      // Verify ownership
      if (analysis.githubId !== session.githubId) {
        return createUnauthorizedResponse('You do not have access to this analysis');
      }

      // Update progress
      analysis.analysisProgress = data.progress;

      // Update performance metrics if provided
      if (data.performanceMetrics) {
        analysis.performanceMetrics = {
          ...analysis.performanceMetrics,
          ...data.performanceMetrics,
          timestamp: new Date(),
        };
      }

      // If analysis is complete, update lastAnalyzed
      if (data.progress.status === "complete") {
        analysis.lastAnalyzed = new Date();
      }

      await analysis.save();

      return createApiResponse(analysis);
    } catch (error) {
      console.error("Failed to update analysis progress:", error);
      return createErrorResponse(
        error instanceof ApiError ? error : new ApiError('update_failed', 'Failed to update progress', 500)
      );
    }
  }
);

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
      ].join(', '),
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
}
