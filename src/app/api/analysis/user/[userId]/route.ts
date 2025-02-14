// src/app/api/analysis/user/[userId]/route.ts
import { NextRequest } from "next/server";
import { z } from 'zod';
import { Analysis } from "@/models/Analysis";
import { decryptSession } from "@/app/api/auth/[...nextauth]/route";
import { 
  createApiResponse, 
  createErrorResponse, 
  createUnauthorizedResponse,
  ApiError 
} from '../../../utils/apiResponse';
import { withValidation } from '../../../utils/validateRequest';

// Validation schemas
const routeParamsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const queryParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  status: z.string().optional(),
  sortBy: z.string().default('lastAnalyzed'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const GET = withValidation(
  queryParamsSchema.merge(routeParamsSchema),
  async (data, request: NextRequest) => {
    try {
      // Verify user session
      const sessionCookie = request.cookies.get("gh_session");
      if (!sessionCookie?.value) {
        return createUnauthorizedResponse();
      }

      const session = decryptSession(sessionCookie.value);

      // Verify user is accessing their own analyses
      if (session.githubId.toString() !== data.userId) {
        return createUnauthorizedResponse('You can only access your own analyses');
      }

      // Build query
      const query: any = { userId: data.userId };
      if (data.status) {
        query["analysisProgress.status"] = data.status;
      }

      // Fetch analyses with pagination
      const analyses = await Analysis.find(query)
        .sort({ [data.sortBy]: data.order === "desc" ? -1 : 1 })
        .skip((data.page - 1) * data.limit)
        .limit(data.limit)
        .lean();

      const total = await Analysis.countDocuments(query);

      return createApiResponse({
        analyses,
        pagination: {
          page: data.page,
          limit: data.limit,
          total,
          totalPages: Math.ceil(total / data.limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch user analyses:", error);
      return createErrorResponse(
        error instanceof ApiError ? error : new ApiError(
          'fetch_failed',
          'Failed to fetch analyses',
          500
        )
      );
    }
  }
);

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
      ].join(', '),
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
}
