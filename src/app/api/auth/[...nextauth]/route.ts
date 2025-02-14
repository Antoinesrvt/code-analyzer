import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/access_token';
const COOKIE_NAME = 'gh_session';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface SessionData {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: number;
}

// Helper function to encrypt session data
function encryptSession(data: SessionData): string {
  const key = process.env.SESSION_SECRET!;
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

// Helper function to decrypt session data
export function decryptSession(encrypted: string): SessionData {
  const key = process.env.SESSION_SECRET!;
  const [ivHex, encryptedData, authTagHex] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
  
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted) as SessionData;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Exchange code for access token
    const params = {
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code: String(code),
      state: String(state),
    } as const;

    if (process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI) {
      Object.assign(params, { redirect_uri: process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI });
    } else if (process.env.NEXT_PUBLIC_APP_URL) {
      Object.assign(params, { redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` });
    } else {
      Object.assign(params, { redirect_uri: 'http://localhost:3000/auth/callback' });
    }

    const tokenResponse = await fetch(GITHUB_OAUTH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      return NextResponse.json(
        { error: error.error || 'Failed to exchange code' },
        { status: 400 }
      );
    }

    const data: GitHubTokenResponse = await tokenResponse.json();
    
    // Immediately fetch user data
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!githubResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
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
    };

    // Encrypt session
    const encryptedSession = encryptSession(session);

    // Set cookie and return user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatar_url,
        url: userData.html_url,
      }
    });
    
    response.cookies.set(COOKIE_NAME, encryptedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(COOKIE_NAME);
    
    if (!sessionCookie) {
      return NextResponse.json({ isAuthenticated: false });
    }

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
      return NextResponse.json({ isAuthenticated: false });
    }

    const userData = await githubResponse.json();
    
    return NextResponse.json({
      isAuthenticated: true,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatar_url,
        url: userData.html_url,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 