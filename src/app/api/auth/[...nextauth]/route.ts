import { NextRequest } from 'next/server';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { z } from 'zod';
import type { SessionData, AuthResponse } from '@/types/auth';
import { 
  createApiResponse, 
  createErrorResponse, 
  ApiError 
} from '../../utils/apiResponse';
import { withValidation } from '../../utils/validateRequest';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/access_token';
const COOKIE_NAME = 'gh_session';
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits for AES-256-GCM
const SALT = 'github-oauth-salt'; // Consistent salt for key derivation

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

// Helper function to validate and derive encryption key
function deriveKey(secret: string): Buffer {
  if (!secret || typeof secret !== 'string') {
    throw new ApiError('config_error', 'SESSION_SECRET environment variable must be set', 500);
  }
  
  if (secret.length < 64) { // At least 32 bytes in hex (64 characters)
    throw new ApiError('config_error', 'SESSION_SECRET must be at least 64 characters long (32 bytes in hex)', 500);
  }

  try {
    // Use scrypt with a consistent salt to derive a 32-byte key
    return scryptSync(secret, SALT, ENCRYPTION_KEY_LENGTH);
  } catch (error) {
    console.error('Key derivation error:', error);
    throw new ApiError('encryption_error', 'Failed to derive encryption key. Check SESSION_SECRET format.', 500);
  }
}

// Helper function to encrypt session data
export function encryptSession(data: SessionData): string {
  try {
    const key = deriveKey(process.env.SESSION_SECRET || '');
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new ApiError(
      'encryption_error',
      'Failed to encrypt session data',
      500,
      { details: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

// Helper function to decrypt session data
export function decryptSession(encrypted: string): SessionData {
  try {
    const key = deriveKey(process.env.SESSION_SECRET || '');
    const [ivHex, encryptedData, authTagHex] = encrypted.split(':');
    
    if (!ivHex || !encryptedData || !authTagHex) {
      throw new ApiError('invalid_format', 'Invalid encrypted data format', 400);
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const parsed = JSON.parse(decrypted);
    if (!parsed || typeof parsed !== 'object') {
      throw new ApiError('invalid_format', 'Invalid session data format', 400);
    }
    
    return parsed as SessionData;
  } catch (error) {
    console.error('Decryption error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'decryption_error',
      'Failed to decrypt session data',
      500,
      { details: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

export const POST = withValidation(callbackSchema, async (data, request: NextRequest) => {
  try {
    // Exchange code for access token
    const params = {
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code: data.code,
      state: data.state,
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
      throw new ApiError(
        'token_exchange_failed',
        error.error || 'Failed to exchange code',
        400
      );
    }

    const tokenData: GitHubTokenResponse = await tokenResponse.json();
    
    // Immediately fetch user data
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
    
    // Create session
    const session = {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      createdAt: Date.now(),
      githubId: userData.id,
    };

    // Encrypt session
    const encryptedSession = encryptSession(session);

    // Create response with user data
    const response = createApiResponse({
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
    
    // Set cookie
    response.cookies.set(COOKIE_NAME, encryptedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Internal server error', 500)
    );
  }
});

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(COOKIE_NAME);
    
    if (!sessionCookie) {
      return createApiResponse({ isAuthenticated: false });
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
      return createApiResponse({ isAuthenticated: false });
    }

    const userData = await githubResponse.json();
    
    return createApiResponse({
      isAuthenticated: true,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatar_url,
        url: userData.html_url,
        type: userData.type || 'User',
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Internal server error', 500)
    );
  }
}

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