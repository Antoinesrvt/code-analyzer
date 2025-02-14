import { NextRequest } from 'next/server';
import { databaseService } from '@/services/database/databaseService';
import { decryptSession } from '@/app/api/auth/[...nextauth]/route';
import { createUnauthorizedResponse } from '@/app/api/utils/apiResponse';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return createUnauthorizedResponse();
    }

    const session = decryptSession(sessionCookie.value);

    // Set up SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const send = async (event: string, data: any) => {
      await writer.write(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    };

    // Start analysis in background
    databaseService.processAnalysis(params.id, {
      onProgress: async (progress) => {
        await send('progress', { progress });
      },
      onComplete: async (data) => {
        await send('complete', data);
        await writer.close();
      },
      onError: async (error) => {
        await send('error', { message: error.message });
        await writer.close();
      }
    }).catch(async (error) => {
      await send('error', { message: 'Failed to start analysis' });
      await writer.close();
    });

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 