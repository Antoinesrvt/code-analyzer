import { NextRequest, NextResponse } from 'next/server';
import { encryptSession } from '../[...nextauth]/route';
import { config } from '@/config/config';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const SESSION_COOKIE = 'gh_session';

// GET handler to initiate GitHub OAuth flow
export async function GET() {
  try {
    // Generate random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Build the authorization URL
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` 
        : 'http://localhost:3000/auth/callback',
      scope: 'repo read:user user:email',
      state: state,
    });

    const url = `${GITHUB_OAUTH_URL}?${params}`;

    return NextResponse.json({ 
      success: true, 
      url,
      state 
    });
  } catch (error) {
    console.error('Failed to initiate GitHub OAuth:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'oauth_init_failed',
        error_description: error instanceof Error ? error.message : 'Failed to initiate GitHub OAuth'
      },
      { status: 500 }
    );
  }
}

// POST handler to exchange code for token
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
        redirect_uri: process.env.NEXT_PUBLIC_APP_URL 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` 
          : 'http://localhost:3000/auth/callback'
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'token_exchange_failed',
          error_description: 'Failed to exchange code for token'
        },
        { status: 400 }
      );
    }

    const data = await tokenResponse.json();
    
    if (data.error) {
      console.error('GitHub OAuth error:', data);
      return NextResponse.json(
        {
          success: false,
          error: data.error,
          error_description: data.error_description
        },
        { status: 400 }
      );
    }

    // Fetch user data
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!githubResponse.ok) {
      console.error('Failed to fetch user data:', await githubResponse.text());
      return NextResponse.json(
        {
          success: false,
          error: 'user_fetch_failed',
          error_description: 'Failed to fetch user data'
        },
        { status: 400 }
      );
    }

    const userData = await githubResponse.json();

    // Create session
    const session = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      createdAt: Date.now(),
      githubId: userData.id
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

    // Set session cookie
    response.cookies.set(SESSION_COOKIE, encryptSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error('GitHub auth error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Authentication failed'
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