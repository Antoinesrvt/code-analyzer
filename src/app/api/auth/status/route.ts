import { NextRequest } from 'next/server';
import { decryptSession } from '../[...nextauth]/route';
import { userService } from '@/services/database/userService';
import { 
  createApiResponse, 
  createErrorResponse, 
  createTimeoutResponse, 
  createUnauthorizedResponse 
} from '../../utils/apiResponse';

const SESSION_COOKIE = 'gh_session';
const GITHUB_API_TIMEOUT = 5000; // 5 seconds

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);

    if (!sessionCookie?.value) {
      return createApiResponse({
        isAuthenticated: false,
        user: null,
        dbUser: null,
        hasToken: false,
      });
    }

    try {
      const session = decryptSession(sessionCookie.value);
      
      // Get user data from GitHub with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT);

      try {
        const githubResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Code-Analyzer',
          },
          signal: controller.signal,
          cache: 'no-store', // Disable caching for this request
        });

        clearTimeout(timeoutId);

        if (!githubResponse.ok) {
          console.error('Failed to fetch user data:', await githubResponse.text());
          return createUnauthorizedResponse('GitHub authentication failed');
        }

        const githubData = await githubResponse.json();
        const githubUser = {
          id: githubData.id,
          login: githubData.login,
          name: githubData.name,
          email: githubData.email,
          avatarUrl: githubData.avatar_url,
          url: githubData.html_url,
          type: githubData.type || 'User',
        };

        // Try to get or create user in our database
        let dbUser = null;
        try {
          dbUser = await userService.findOrCreateUser(githubUser);
        } catch (dbError) {
          console.error('Database error:', dbError);
          // Continue without database user, but log the error
          console.error('Failed to get/create database user:', dbError);
        }

        return createApiResponse({
          isAuthenticated: true,
          user: githubUser,
          dbUser: dbUser ? {
            githubId: dbUser.githubId,
            email: dbUser.email,
            login: dbUser.login,
            name: dbUser.name,
            avatarUrl: dbUser.avatarUrl,
            plan: dbUser.plan,
            lastLoginAt: dbUser.lastLoginAt,
            createdAt: dbUser.createdAt,
            updatedAt: dbUser.updatedAt,
          } : null,
          hasToken: true,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('GitHub API request timed out');
          return createTimeoutResponse();
        }
        throw fetchError;
      }
    } catch (decryptError) {
      console.error('Session decryption error:', decryptError);
      return createUnauthorizedResponse('Invalid session');
    }
  } catch (error) {
    console.error('Status check error:', error);
    return createErrorResponse(error);
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
      ].join(', '),
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
} 