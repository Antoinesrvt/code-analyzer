import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse, createUnauthorizedResponse, ApiError } from '../../../utils/apiResponse';
import { decryptSession } from '../../[...nextauth]/route';

const GITHUB_API_URL = 'https://api.github.com';
const SESSION_COOKIE = 'gh_session';

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request);
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    // Check authentication
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse('Authentication required');
    }

    const session = decryptSession(sessionCookie.value);
    if (!session.accessToken) {
      return createUnauthorizedResponse('Authentication required');
    }

    // Get the API path from the URL
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/auth/github/proxy', '');
    if (!path) {
      throw new ApiError('invalid_request', 'Invalid API path', 400);
    }

    // Forward the request to GitHub API
    const githubUrl = `${GITHUB_API_URL}${path}${url.search}`;
    const body = request.method !== 'GET' ? await request.text() : undefined;

    const response = await fetch(githubUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'code-analyzer',
      },
      ...(body && { body }),
    });

    const data = await response.json().catch(() => null);

    // Create API response with GitHub data and status code
    const apiResponse = createApiResponse(data || { message: 'No content' }, response.status);

    // Forward rate limiting headers
    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'x-ratelimit-used'
    ];

    rateLimitHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        apiResponse.headers.set(header, value);
      }
    });

    return apiResponse;
  } catch (error) {
    console.error('GitHub API proxy error:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Failed to proxy request to GitHub API', 500)
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://code-analyzer-five.vercel.app'
  ];

  // Only set CORS headers if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': [
          'X-CSRF-Token',
          'X-Requested-With',
          'Accept',
          'Accept-Version',
          'Content-Length',
          'Content-MD5',
          'Content-Type',
          'Date',
          'X-Api-Version',
          'Authorization'
        ].join(', ')
      }
    });
  }

  return new NextResponse(null, { status: 200 });
} 