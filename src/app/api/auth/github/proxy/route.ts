import { NextRequest, NextResponse } from 'next/server';

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
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'Authentication required'
        },
        { status: 401 }
      );
    }

    const session = JSON.parse(sessionCookie.value);
    if (!session.isAuthenticated || !session.accessToken) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Get the API path from the URL
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/auth/github/proxy', '');
    if (!path) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Invalid API path'
        },
        { status: 400 }
      );
    }

    // Forward the request to GitHub API
    const githubUrl = `${GITHUB_API_URL}${path}${url.search}`;
    const body = request.method !== 'GET' ? await request.text() : undefined;

    const response = await fetch(githubUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `${session.tokenType} ${session.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'code-analyzer',
      },
      ...(body && { body }),
    });

    const data = await response.json().catch(() => null);

    // Forward GitHub's status code
    const proxyResponse = NextResponse.json(
      data || { message: 'No content' },
      { status: response.status }
    );

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
        proxyResponse.headers.set(header, value);
      }
    });

    return proxyResponse;
  } catch (error) {
    console.error('GitHub API proxy error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Failed to proxy request to GitHub API'
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