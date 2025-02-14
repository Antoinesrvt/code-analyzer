import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '../../auth/[...nextauth]/route';

const GITHUB_API_URL = 'https://api.github.com';
const SESSION_COOKIE = 'gh_session';

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
    
    // Forward search params
    const searchParams = new URLSearchParams(request.nextUrl.searchParams);
    if (searchParams.size > 0) {
      url.search = searchParams.toString();
    }

    // Forward request to GitHub API
    const githubResponse = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'code-analyzer',
      },
    });

    if (!githubResponse.ok) {
      const error = await githubResponse.text();
      console.error(`GitHub API error (${githubResponse.status}):`, error);
      
      if (githubResponse.status === 401) {
        return NextResponse.json(
          {
            error: 'unauthorized',
            error_description: 'GitHub token is invalid or expired'
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: 'github_api_error',
          error_description: `GitHub API returned ${githubResponse.status}`
        },
        { status: githubResponse.status }
      );
    }

    const data = await githubResponse.json();
    return NextResponse.json(data);
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
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'code-analyzer',
      },
      body: JSON.stringify(await request.json()),
    });

    if (!githubResponse.ok) {
      const error = await githubResponse.text();
      console.error(`GitHub API error (${githubResponse.status}):`, error);
      
      if (githubResponse.status === 401) {
        return NextResponse.json(
          {
            error: 'unauthorized',
            error_description: 'GitHub token is invalid or expired'
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: 'github_api_error',
          error_description: `GitHub API returned ${githubResponse.status}`
        },
        { status: githubResponse.status }
      );
    }

    const data = await githubResponse.json();
    return NextResponse.json(data);
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