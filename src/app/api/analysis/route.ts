import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/services/database/databaseService';
import { decryptSession } from '@/app/api/auth/[...nextauth]/route';
import { UserPlan } from '@/models/Analysis';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const session = decryptSession(sessionCookie.value);
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || undefined;

    const result = await databaseService.getUserAnalyses(session.githubId, page, limit, status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch analyses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analyses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repository name are required' },
        { status: 400 }
      );
    }

    // Verify user session
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const session = decryptSession(sessionCookie.value);

    // Check for existing analysis
    const existingAnalysis = await databaseService.getUserAnalysis(
      session.githubId,
      owner,
      repo
    );

    if (existingAnalysis && !existingAnalysis.isExpired()) {
      return NextResponse.json(existingAnalysis);
    }

    // Create new analysis
    const analysis = await databaseService.createAnalysis({
      githubId: session.githubId,
      owner,
      repo
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Failed to create analysis:', error);
    return NextResponse.json(
      { error: 'Failed to create analysis' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const repositoryId = searchParams.get('repositoryId');

    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Verify user session
    const sessionCookie = request.cookies.get('gh_session');
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const success = await databaseService.deleteAnalysis(parseInt(repositoryId));
    if (!success) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete analysis:', error);
    return NextResponse.json(
      { error: 'Failed to delete analysis' },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 