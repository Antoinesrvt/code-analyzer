import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: Date.now(),
    },
    { status }
  );
}

export function createErrorResponse(
  error: Error | ApiError | ZodError,
  status: number = 500
): NextResponse<ApiResponse> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        timestamp: Date.now(),
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: error.errors,
        },
        timestamp: Date.now(),
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'internal_server_error',
        message: error.message || 'An unexpected error occurred',
      },
      timestamp: Date.now(),
    },
    { status }
  );
}

export function createTimeoutResponse(): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'timeout',
        message: 'Request timed out',
      },
      timestamp: Date.now(),
    },
    { status: 408 }
  );
}

export function createUnauthorizedResponse(
  message: string = 'Unauthorized'
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'unauthorized',
        message,
      },
      timestamp: Date.now(),
    },
    { status: 401 }
  );
} 