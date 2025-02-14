import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '../../auth/[...nextauth]/route';
import type { GitHubError } from '@/types/auth';

const GITHUB_API_URL = 'https://api.github.com';
const SESSION_COOKIE = 'gh_session';

const DEFAULT_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'code-analyzer',
  'X-GitHub-Api-Version': '2022-11-28'
};

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
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          error_description: 'GitHub API rate limit exceeded',
          rate_limit: rateLimit,
          reset_at: new Date(Number(rateLimit.reset) * 1000).toISOString()
        },
        { status: 403 }
      );
    }

    // Handle authentication errors
    if (response.status === 401) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'GitHub token is invalid or expired',
          details: errorData.message
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'github_api_error',
        error_description: errorData.message,
        documentation_url: errorData.documentation_url,
        rate_limit: rateLimit
      },
      { status: response.status }
    );
  }

  const data = await response.json();
  const responseHeaders = new Headers();
  
  // Forward rate limit information
  Object.entries(rateLimit).forEach(([key, value]) => {
    if (value) responseHeaders.set(`x-ratelimit-${key}`, value);
  });

  return NextResponse.json(data, { headers: responseHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Decrypt session
    const session = decryptSession(sessionCookie.value);
    if (!session.accessToken) {
      return NextResponse.json(
        {
          error: 'invalid_session',
          error_description: 'Invalid session format'
        },
        { status: 401 }
      );
    }

    // Build GitHub API URL
    const path = params.path.join('/');
    const url = new URL(path, GITHUB_API_URL);
    
    // Forward search params except 'plan'
    const searchParams = new URLSearchParams(request.nextUrl.searchParams);
    searchParams.delete('plan'); // Remove plan parameter before forwarding to GitHub
    if (searchParams.size > 0) {
      url.search = searchParams.toString();
    }

    // Forward request to GitHub API
    const githubResponse = await fetch(url.toString(), {
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    const responseData = await githubResponse.json();

    // If this is a repository request, format the response
    if (path === 'user/repositories' || path.includes('search/repositories')) {
      return NextResponse.json({
        repositories: Array.isArray(responseData.items || responseData) 
          ? (responseData.items || responseData)
          : []
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('GitHub proxy error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Decrypt session
    const session = decryptSession(sessionCookie.value);
    if (!session.accessToken) {
      return NextResponse.json(
        {
          error: 'invalid_session',
          error_description: 'Invalid session format'
        },
        { status: 401 }
      );
    }

    // Build GitHub API URL
    const path = params.path.join('/');
    const url = new URL(path, GITHUB_API_URL);

    // Forward request to GitHub API
    const githubResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(await request.json()),
    });

    return handleGitHubResponse(githubResponse);
  } catch (error) {
    console.error('GitHub proxy error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': [
          'X-CSRF-Token',
          'X-Requested-With',
          'Accept',
          'Accept-Version',
          'Content-Length',
          'Content-MD5',
          'Content-Type',
          'Date',
          'X-Api-Version'
        ].join(', ')
      }
    });
  }

  return new NextResponse(null, { status: 200 });
} 