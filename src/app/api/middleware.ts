import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './auth/[...nextauth]/route';
import { createUnauthorizedResponse } from './utils/apiResponse';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://code-analyzer-five.vercel.app'
];

const publicPaths = [
  '/api/auth/github',
  '/api/auth/status',
  '/api/auth/logout'
];

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
  ].join(', '),
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // Maximum requests per window
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function getRateLimitKey(request: NextRequest): string {
  // Use forwarded IP or connection remote address as the rate limit key
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const sessionCookie = request.cookies.get('gh_session');
  return sessionCookie ? `${ip}_${sessionCookie.value}` : ip;
}

function isRateLimited(request: NextRequest): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const rateLimit = rateLimitMap.get(key);

  // Clean up expired entries
  for (const [k, v] of rateLimitMap.entries()) {
    if (now - v.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(k);
    }
  }

  if (!rateLimit) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return false;
  }

  if (now - rateLimit.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return false;
  }

  if (rateLimit.count >= RATE_LIMIT_MAX) {
    return true;
  }

  rateLimit.count++;
  return false;
}

export async function middleware(request: NextRequest) {
  // Get the origin from the request headers
  const origin = request.headers.get('origin');
  const requestPath = request.nextUrl.pathname;

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const headers = new Headers(corsHeaders);
    if (origin && allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // Check rate limiting for analysis endpoints
  if (requestPath.startsWith('/api/analysis')) {
    if (isRateLimited(request)) {
      return new NextResponse(
        JSON.stringify({
          error: {
            code: 'rate_limit_exceeded',
            message: 'Too many requests, please try again later.',
            details: {
              retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
              unit: 'seconds'
            }
          }
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString()
          }
        }
      );
    }
  }

  // Create a mutable request to modify
  const requestHeaders = new Headers(request.headers);
  
  // Extract route parameters for dynamic routes
  const matches = requestPath.match(/\/api\/github\/(.+)/);
  if (matches) {
    const pathParams = matches[1].split('/');
    // Add path parameters to the request for handlers to access
    requestHeaders.set('x-path-params', JSON.stringify(pathParams));
  }

  // Create response object to modify and return
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Handle CORS for non-preflight requests
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // Skip auth check for public paths
  if (publicPaths.some(path => requestPath.startsWith(path))) {
    return response;
  }

  // Check authentication
  const session = request.cookies.get('gh_session');
  if (!session?.value) {
    return createUnauthorizedResponse('Authentication required');
  }

  try {
    const sessionData = decryptSession(session.value);
    const now = Date.now();
    const sessionAge = now - sessionData.createdAt;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

    // Check if session has expired
    if (sessionAge > maxAge) {
      return createUnauthorizedResponse('Session has expired');
    }

    // Verify token is present
    if (!sessionData.accessToken) {
      return createUnauthorizedResponse('Invalid session format');
    }

    // Add session data to request headers for downstream use
    response.headers.set('X-Session-Data', JSON.stringify({
      accessToken: sessionData.accessToken,
      createdAt: sessionData.createdAt,
    }));

    return response;
  } catch (error) {
    console.error('Session validation error:', error);
    return createUnauthorizedResponse('Invalid session format');
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 