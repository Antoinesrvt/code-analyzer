// src/app/api/analysis/[id]/route.ts
import { NextRequest } from "next/server";
import { z } from 'zod';
import { Analysis } from "@/models/Analysis";
import { decryptSession } from "@/app/api/auth/[...nextauth]/route";
import { 
  createApiResponse, 
  createErrorResponse, 
  createUnauthorizedResponse,
  ApiError 
} from '../../utils/apiResponse';
import { withValidation } from '../../utils/validateRequest';

// Validation schema for route parameters
const routeParamsSchema = z.object({
  id: z.string().min(1, 'Analysis ID is required'),
});

export const GET = withValidation(routeParamsSchema, async (data, request: NextRequest) => {
  try {
    // Verify user session
    const sessionCookie = request.cookies.get("gh_session");
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse();
    }

    const session = decryptSession(sessionCookie.value);

    // Find analysis
    const analysis = await Analysis.findById(data.id);
    if (!analysis) {
      throw new ApiError('not_found', 'Analysis not found', 404);
    }

    // Verify ownership
    if (analysis.githubId !== session.githubId) {
      return createUnauthorizedResponse('You do not have access to this analysis');
    }

    return createApiResponse(analysis);
  } catch (error) {
    console.error("Failed to fetch analysis:", error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('fetch_failed', 'Failed to fetch analysis', 500)
    );
  }
});

export const DELETE = withValidation(routeParamsSchema, async (data, request: NextRequest) => {
  try {
    // Verify user session
    const sessionCookie = request.cookies.get("gh_session");
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse();
    }

    const session = decryptSession(sessionCookie.value);

    // Find analysis
    const analysis = await Analysis.findById(data.id);
    if (!analysis) {
      throw new ApiError('not_found', 'Analysis not found', 404);
    }

    // Verify ownership
    if (analysis.githubId !== session.githubId) {
      return createUnauthorizedResponse('You do not have access to this analysis');
    }

    await analysis.deleteOne();

    return createApiResponse({ success: true });
  } catch (error) {
    console.error("Failed to delete analysis:", error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('deletion_failed', 'Failed to delete analysis', 500)
    );
  }
});

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
      ].join(', '),
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
}
