import { NextRequest } from 'next/server';
import { z } from 'zod';
import { decryptSession } from '../../auth/[...nextauth]/route';
import type { GitHubError } from '@/types/auth';
import { 
  createApiResponse, 
  createErrorResponse, 
  createUnauthorizedResponse,
  ApiError 
} from '../../utils/apiResponse';
import { withValidation } from '../../utils/validateRequest';

const GITHUB_API_URL = 'https://api.github.com';
const SESSION_COOKIE = 'gh_session';

const DEFAULT_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'code-analyzer',
  'X-GitHub-Api-Version': '2022-11-28'
};

// Validation schemas for repository endpoints
const repoParamsSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().optional().default(30),
  sort: z.enum(['created', 'updated', 'pushed', 'full_name']).optional().default('pushed'),
  direction: z.enum(['asc', 'desc']).optional().default('desc'),
  type: z.enum(['all', 'owner', 'public', 'private', 'member']).optional().default('owner'),
  affiliation: z.string().optional(),
  visibility: z.enum(['all', 'public', 'private']).optional(),
  plan: z.string().optional(),
});

// General search params schema for other endpoints
const searchParamsSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().optional().default(30),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  plan: z.string().optional(),
});

async function handleGitHubResponse(response: Response) {
  const rateLimit = {
    limit: response.headers.get('x-ratelimit-limit'),
    remaining: response.headers.get('x-ratelimit-remaining'),
    reset: response.headers.get('x-ratelimit-reset'),
    used: response.headers.get('x-ratelimit-used'),
  };

  if (!response.ok) {
    const error = await response.text();
    console.error(`GitHub API error (${response.status}):`, error);
    let errorData: GitHubError;
    
    try {
      errorData = JSON.parse(error);
    } catch {
      errorData = {
        message: error,
        documentation_url: null
      };
    }

    // Handle rate limiting specifically
    if (response.status === 403 && Number(rateLimit.remaining) === 0) {
      return createErrorResponse(
        new ApiError(
          'rate_limit_exceeded',
          'GitHub API rate limit exceeded',
          403,
          { 
            rate_limit: rateLimit, 
            reset_at: new Date(Number(rateLimit.reset) * 1000).toISOString() 
          }
        )
      );
    }

    // Handle authentication errors
    if (response.status === 401) {
      return createUnauthorizedResponse('GitHub token is invalid or expired');
    }

    return createErrorResponse(
      new ApiError(
        'github_api_error',
        errorData.message,
        response.status,
        {
          documentation_url: errorData.documentation_url,
          rate_limit: rateLimit
        }
      )
    );
  }

  const data = await response.json();
  console.log('GitHub API response:', data); // Debug log

  // For repository endpoints, ensure we're returning an array
  const responseData = Array.isArray(data) ? { repositories: data } : data;
  const apiResponse = createApiResponse(responseData, 200);
  
  // Add rate limit headers to the response
  Object.entries(rateLimit).forEach(([key, value]) => {
    if (value) {
      apiResponse.headers.set(`x-ratelimit-${key}`, value);
    }
  });

  return apiResponse;
}

export const GET = withValidation(repoParamsSchema, async (data, request: NextRequest) => {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse('Authentication required');
    }

    const session = decryptSession(sessionCookie.value);
    if (!session.accessToken) {
      return createUnauthorizedResponse('Invalid session format');
    }

    // Extract path from URL
    const url = new URL(request.url);
    const pathMatch = url.pathname.match(/^\/api\/github\/(.+)$/);
    if (!pathMatch) {
      throw new ApiError('invalid_request', 'Invalid API path', 400);
    }

    // Build GitHub API URL
    const githubPath = pathMatch[1];
    let githubUrl: URL;

    // Handle repository endpoints specifically
    if (githubPath === 'user/repositories') {
      githubUrl = new URL('/user/repos', GITHUB_API_URL);
      
      // Forward validated params except 'plan'
      const { plan, ...params } = data;
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'affiliation' && Array.isArray(value)) {
            githubUrl.searchParams.set(key, value.join(','));
          } else {
            githubUrl.searchParams.set(key, value.toString());
          }
        }
      });

      // Forward request to GitHub API
      const githubResponse = await fetch(githubUrl.toString(), {
        headers: {
          ...DEFAULT_HEADERS,
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });

      const response = await handleGitHubResponse(githubResponse);
      
      // Ensure we're wrapping the repositories array in the expected format
      if (response.status === 200) {
        const repositories = await response.json();
        return createApiResponse({ repositories: repositories.data }, 200);
      }
      
      return response;
    } else {
      githubUrl = new URL(githubPath, GITHUB_API_URL);
      url.searchParams.forEach((value, key) => {
        if (key !== 'plan') {
          githubUrl.searchParams.set(key, value);
        }
      });

      const githubResponse = await fetch(githubUrl.toString(), {
        headers: {
          ...DEFAULT_HEADERS,
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });

      return handleGitHubResponse(githubResponse);
    }
  } catch (error) {
    console.error('GitHub proxy error:', error);
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        new ApiError('invalid_request', 'Invalid path parameters format', 400)
      );
    }
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Internal server error', 500)
    );
  }
});

export const POST = withValidation(z.any(), async (data, request: NextRequest) => {
  try {
    // Get path parameters from request headers
    const pathParamsHeader = request.headers.get('x-path-params');
    if (!pathParamsHeader) {
      return createErrorResponse(
        new ApiError('invalid_request', 'Missing path parameters', 400)
      );
    }

    const pathParams = JSON.parse(pathParamsHeader);

    // Get session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse('Authentication required');
    }

    // Decrypt session
    const session = decryptSession(sessionCookie.value);
    if (!session.accessToken) {
      return createUnauthorizedResponse('Invalid session format');
    }

    // Build GitHub API URL
    const path = pathParams.join('/');
    const url = new URL(path, GITHUB_API_URL);

    // Forward request to GitHub API
    const githubResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return handleGitHubResponse(githubResponse);
  } catch (error) {
    console.error('GitHub proxy error:', error);
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        new ApiError('invalid_request', 'Invalid path parameters format', 400)
      );
    }
    return createErrorResponse(
      new ApiError('server_error', 'Internal server error', 500)
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