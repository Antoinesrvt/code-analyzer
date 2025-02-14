import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from './apiResponse';

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationError = {
  success: false;
  response: Response;
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

function isValidationError(result: ValidationResult<any>): result is ValidationError {
  return !result.success;
}

export async function validateRequest<T>(
  request: NextRequest,
  schema: z.Schema<T>
): Promise<ValidationResult<T>> {
  try {
    let data: any;

    // Handle different content types
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await request.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      data = Object.fromEntries(formData);
    } else if (request.method === 'GET') {
      const searchParams = Object.fromEntries(new URL(request.url).searchParams);
      data = searchParams;
    } else {
      return {
        success: false,
        response: createErrorResponse(
          new Error('Unsupported content type'),
          415
        ),
      };
    }

    const validatedData = await schema.parseAsync(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: createErrorResponse(error, 400),
      };
    }

    return {
      success: false,
      response: createErrorResponse(
        error instanceof Error ? error : new Error('Validation failed'),
        400
      ),
    };
  }
}

export function withValidation<T>(
  schema: z.Schema<T>,
  handler: (data: T, request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest) => {
    const validation = await validateRequest(request, schema);
    
    if (isValidationError(validation)) {
      return validation.response;
    }

    return handler(validation.data, request);
  };
} 