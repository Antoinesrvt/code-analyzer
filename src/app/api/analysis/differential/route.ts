import { NextRequest, NextResponse } from 'next/server';
import { differentialService } from '@/services/analysis/differentialService';
import { Analysis } from '@/models/Analysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, currentCommit, previousCommit } = body;

    if (!owner || !repo || !currentCommit || !previousCommit) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get the existing analysis or create a new one
    const analysis = await Analysis.findOne({
      'repository.owner.login': owner,
      'repository.name': repo
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Repository analysis not found' },
        { status: 404 }
      );
    }

    // Check user plan limits
    if (analysis.historicalAnalyses.length >= analysis.retentionPolicy.maxHistoryCount) {
      return NextResponse.json(
        { 
          error: 'Historical analysis limit reached',
          plan: analysis.userPlan,
          limit: analysis.retentionPolicy.maxHistoryCount
        },
        { status: 403 }
      );
    }

    // Perform differential analysis
    const differentialAnalysis = await differentialService.analyzeDifferential(
      owner,
      repo,
      currentCommit,
      previousCommit
    );

    // Update the analysis with the new differential data
    analysis.historicalAnalyses.push(differentialAnalysis);
    await analysis.pruneHistory();

    return NextResponse.json(differentialAnalysis);
  } catch (error) {
    console.error('Differential analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform differential analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const commitHash = searchParams.get('commit');

    if (!owner || !repo || !commitHash) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const analysis = await Analysis.findOne({
      'repository.owner.login': owner,
      'repository.name': repo
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Repository analysis not found' },
        { status: 404 }
      );
    }

    const historicalAnalysis = await analysis.getHistoricalAnalysis(commitHash);
    
    if (!historicalAnalysis) {
      return NextResponse.json(
        { error: 'Historical analysis not found for this commit' },
        { status: 404 }
      );
    }

    return NextResponse.json(historicalAnalysis);
  } catch (error) {
    console.error('Failed to fetch historical analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical analysis' },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 