import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { encryptSession, decryptSession } from '../[...nextauth]/route';
import type { SessionData } from '@/types/auth';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const STATE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const SESSION_COOKIE = 'gh_session';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

// GET handler for initiating OAuth flow
export async function GET() {
  try {
    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET environment variable is not set');
    }

    const state = randomUUID();
    const timestamp = Date.now();

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

    try {
      // Set state cookie for validation using encryption
      const stateSession: SessionData = {
        accessToken: '',
        tokenType: '',
        scope: '',
        createdAt: timestamp,
        oauthState: state,
        githubId: 0 // Placeholder, will be set during callback
      };

      response.cookies.set('oauth_state', encryptSession(stateSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: STATE_TIMEOUT / 1000,
      });
    } catch (encryptError) {
      console.error('Session encryption error:', encryptError);
      return NextResponse.json(
        {
          success: false,
          error: 'encryption_error',
          error_description: 'Failed to secure session data. Please check server configuration.'
        },
        { status: 500 }
      );
    }

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
          success: false,
          error: 'invalid_request',
          error_description: 'Missing code or state parameter'
        },
        { status: 400 }
      );
    }

    // Get and validate state from encrypted cookie
    const stateCookie = request.cookies.get('oauth_state');
    if (!stateCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_state',
          error_description: 'No state cookie found'
        },
        { status: 400 }
      );
    }

    const stateSession = decryptSession(stateCookie.value);
    if (stateSession.oauthState !== state) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_state',
          error_description: 'Invalid state parameter'
        },
        { status: 400 }
      );
    }

    // Check state timeout
    const stateAge = Date.now() - stateSession.createdAt;
    if (stateAge > STATE_TIMEOUT) {
      return NextResponse.json(
        {
          success: false,
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
          success: false,
          error: error.error || 'token_exchange_failed',
          error_description: error.error_description || 'Failed to exchange code for token'
        },
        { status: 400 }
      );
    }

    const data: GitHubTokenResponse = await tokenResponse.json();

    // Fetch user data immediately
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!githubResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'user_data_failed',
          error_description: 'Failed to fetch user data'
        },
        { status: 400 }
      );
    }

    const userData = await githubResponse.json();

    // Create new session with githubId
    const newSession: SessionData = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      createdAt: Date.now(),
      githubId: userData.id // Include GitHub ID in session
    };

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatar_url,
        url: userData.html_url,
        type: userData.type || 'User',
      }
    });

    // Set encrypted session cookie
    response.cookies.set(SESSION_COOKIE, encryptSession(newSession), {
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
        success: false,
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