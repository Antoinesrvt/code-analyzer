import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const STATE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const SESSION_COOKIE = 'gh_session';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

// GET handler for initiating OAuth flow
export async function GET() {
  try {
    // Generate state and timestamp
    const state = randomUUID();
    const timestamp = Date.now();

    // Create OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` : 'http://localhost:3000/auth/callback',
      state,
      scope: 'repo read:user user:email',
    });

    const response = NextResponse.json({
      success: true,
      url: `${GITHUB_OAUTH_URL}?${params}`,
      state,
    });

    // Set state cookie for validation
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_TIMEOUT / 1000, // Convert to seconds
    });

    return response;
  } catch (error) {
    console.error('GitHub auth initialization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Failed to initialize GitHub OAuth'
      },
      { status: 500 }
    );
  }
}

// POST handler for handling OAuth callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Missing code or state parameter'
        },
        { status: 400 }
      );
    }

    // Get session from cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          error: 'invalid_session',
          error_description: 'No session found'
        },
        { status: 400 }
      );
    }

    const session = JSON.parse(sessionCookie.value);

    // Validate state
    if (!session?.oauthState?.value || session.oauthState.value !== state) {
      return NextResponse.json(
        {
          error: 'invalid_state',
          error_description: 'Invalid or missing state parameter'
        },
        { status: 400 }
      );
    }

    // Check state timeout
    const stateAge = Date.now() - (session.oauthState.timestamp || 0);
    if (stateAge > STATE_TIMEOUT) {
      return NextResponse.json(
        {
          error: 'state_expired',
          error_description: 'State parameter has expired'
        },
        { status: 400 }
      );
    }

    const redirectUri = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` 
      : 'http://localhost:3000/auth/callback';

    // Exchange code for access token
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
        state,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('Token exchange error:', error);
      return NextResponse.json(
        {
          error: error.error || 'token_exchange_failed',
          error_description: error.error_description || 'Failed to exchange code for token'
        },
        { status: 400 }
      );
    }

    const data: GitHubTokenResponse = await tokenResponse.json();

    // Create new session with token
    const newSession = {
      isAuthenticated: true,
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      user: session?.user || null,
      // Remove oauthState as it's no longer needed
      oauthState: undefined
    };

    // Create response with new session
    const response = NextResponse.json({ success: true });

    // Set session cookie in response
    response.cookies.set(SESSION_COOKIE, JSON.stringify(newSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error('GitHub auth callback error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Failed to complete GitHub OAuth'
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