import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/services/databaseService';
import { githubService } from '@/services/githubService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const result = await databaseService.listAnalyses(page, limit);
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
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    // Check if we have a recent analysis
    const existingAnalysis = await databaseService.getAnalysis(url);
    if (existingAnalysis && !existingAnalysis.isExpired()) {
      return NextResponse.json(existingAnalysis);
    }

    // Perform new analysis
    const analysis = await githubService.analyzeRepository(url);
    
    // Save to database
    const savedAnalysis = await databaseService.saveAnalysis({
      repositoryId: analysis.id,
      repository: analysis,
      files: analysis.files,
      modules: analysis.modules,
      performanceMetrics: {
        analysisTime: analysis.performanceMetrics.totalTime || 0,
        apiCalls: analysis.performanceMetrics.apiCalls || 0,
        memoryUsage: analysis.performanceMetrics.memoryUsage || 0,
      },
      analysisProgress: analysis.analysisProgress,
    });

    return NextResponse.json(savedAnalysis);
  } catch (error) {
    console.error('Failed to analyze repository:', error);
    return NextResponse.json(
      { error: 'Failed to analyze repository' },
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