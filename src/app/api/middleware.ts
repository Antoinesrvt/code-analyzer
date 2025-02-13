import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  // Get the origin from the request headers
  const origin = request.headers.get('origin');
  const requestPath = request.nextUrl.pathname;

  // Create response object to modify and return
  const response = NextResponse.next();

  // Handle CORS
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', origin);
    
    // Add other CORS headers for preflight requests
    if (request.method === 'OPTIONS') {
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', [
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Accept-Version',
        'Content-Length',
        'Content-MD5',
        'Content-Type',
        'Date',
        'X-Api-Version'
      ].join(', '));
      
      // Early return for preflight requests
      return new NextResponse(null, { headers: response.headers });
    }
  }

  // Check authentication for non-public paths
  if (!publicPaths.some(path => requestPath.startsWith(path))) {
    const session = request.cookies.get('gh_session');
    
    if (!session?.value) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'Authentication required'
        },
        { status: 401 }
      );
    }

    try {
      const sessionData = JSON.parse(session.value);
      if (!sessionData.isAuthenticated) {
        return NextResponse.json(
          {
            error: 'unauthorized',
            error_description: 'Authentication required'
          },
          { status: 401 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: 'invalid_session',
          error_description: 'Invalid session format'
        },
        { status: 401 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
}; 