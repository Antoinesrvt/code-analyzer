import { createApiResponse, createErrorResponse, ApiError } from '../../utils/apiResponse';

const SESSION_COOKIE = 'gh_session';

export async function POST() {
  try {
    // Create response with success status
    const response = createApiResponse({ success: true });

    // Clear session cookie
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0)
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse(
      error instanceof ApiError ? error : new ApiError('server_error', 'Failed to logout', 500)
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
      ].join(', '),
      'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    },
  });
} 