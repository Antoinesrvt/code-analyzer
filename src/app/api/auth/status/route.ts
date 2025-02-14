import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '../[...nextauth]/route';
import { userService } from '@/services/database/userService';

const SESSION_COOKIE = 'gh_session';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);

    if (!sessionCookie?.value) {
      return NextResponse.json({
        isAuthenticated: false,
        user: null,
        dbUser: null,
        hasToken: false,
        timestamp: Date.now()
      });
    }

    try {
      const session = decryptSession(sessionCookie.value);
      
      // Get user data from GitHub
      const githubResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!githubResponse.ok) {
        console.error('Failed to fetch user data:', await githubResponse.text());
        return NextResponse.json({
          isAuthenticated: false,
          user: null,
          dbUser: null,
          hasToken: false,
          timestamp: Date.now()
        });
      }

      const githubData = await githubResponse.json();

      // Get or create user in our database
      const dbUser = await userService.findOrCreateUser({
        id: githubData.id,
        login: githubData.login,
        name: githubData.name,
        email: githubData.email,
        avatarUrl: githubData.avatar_url,
        url: githubData.html_url,
        type: githubData.type || 'User',
      });

      return NextResponse.json({
        isAuthenticated: true,
        user: {
          id: githubData.id,
          login: githubData.login,
          name: githubData.name,
          email: githubData.email,
          avatarUrl: githubData.avatar_url,
          url: githubData.html_url,
          type: githubData.type || 'User',
        },
        dbUser: {
          githubId: dbUser.githubId,
          email: dbUser.email,
          login: dbUser.login,
          name: dbUser.name,
          avatarUrl: dbUser.avatarUrl,
          plan: dbUser.plan,
          lastLoginAt: dbUser.lastLoginAt,
          createdAt: dbUser.createdAt,
          updatedAt: dbUser.updatedAt,
        },
        hasToken: true,
        timestamp: Date.now()
      });
    } catch (decryptError) {
      console.error('Session decryption error:', decryptError);
      return NextResponse.json({
        isAuthenticated: false,
        user: null,
        dbUser: null,
        hasToken: false,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Failed to check authentication status',
        timestamp: Date.now()
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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