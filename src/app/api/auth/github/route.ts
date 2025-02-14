import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { encryptSession, decryptSession } from '../[...nextauth]/route';
import type { SessionData } from '@/types/auth';
import { 
  createApiResponse, 
  createErrorResponse, 
  ApiError 
} from '../../utils/apiResponse';
import { z } from 'zod';
import { withValidation } from '../../utils/validateRequest';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const STATE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const SESSION_COOKIE = 'gh_session';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

// Validation schema for callback
const callbackSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  state: z.string().min(1, 'State is required'),
});

// GET handler for initiating OAuth flow
export async function GET() {
  try {
    if (!process.env.SESSION_SECRET) {
      throw new ApiError('config_error', 'SESSION_SECRET environment variable is not set', 500);
    }

    const state = randomUUID();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` : 'http://localhost:3000/auth/callback',
      state,
      scope: 'repo read:user user:email',
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

      const response = createApiResponse({
        url: `${GITHUB_OAUTH_URL}?${params}`,
        state,
      });

      response.cookies.set('oauth_state', encryptSession(stateSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: STATE_TIMEOUT / 1000,
      });

      return response;
    } catch (encryptError) {
      throw new ApiError('encryption_error', 'Failed to secure session data', 500);
    }
  } catch (error) {
    console.error('GitHub auth initialization error:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Failed to initialize GitHub OAuth', 500)
    );
  }
}

// POST handler for handling OAuth callback
export const POST = withValidation(callbackSchema, async (data, request: NextRequest) => {
  try {
    // Get and validate state from encrypted cookie
    const stateCookie = request.cookies.get('oauth_state');
    if (!stateCookie?.value) {
      throw new ApiError('invalid_state', 'No state cookie found', 400);
    }

    const stateSession = decryptSession(stateCookie.value);
    if (stateSession.oauthState !== data.state) {
      throw new ApiError('invalid_state', 'Invalid state parameter', 400);
    }

    // Check state timeout
    const stateAge = Date.now() - stateSession.createdAt;
    if (stateAge > STATE_TIMEOUT) {
      throw new ApiError('state_expired', 'State parameter has expired', 400);
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
        code: data.code,
        state: data.state,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new ApiError(
        'token_exchange_failed',
        error.error_description || 'Failed to exchange code for token',
        400
      );
    }

    const tokenData: GitHubTokenResponse = await tokenResponse.json();

    // Fetch user data immediately
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!githubResponse.ok) {
      throw new ApiError('user_data_failed', 'Failed to fetch user data', 400);
    }

    const userData = await githubResponse.json();

    // Create new session with githubId
    const newSession: SessionData = {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      createdAt: Date.now(),
      githubId: userData.id
    };

    // Create response with user data
    const response = createApiResponse({
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
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Failed to complete GitHub OAuth', 500)
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