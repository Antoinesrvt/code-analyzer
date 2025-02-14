// src/app/api/analysis/[id]/progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Analysis } from "@/models/Analysis";
import { decryptSession } from "@/app/api/auth/[...nextauth]/route";
import type { AnalysisProgress } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const progress: AnalysisProgress = body.progress;
    const performanceUpdate = body.performanceMetrics;

    // Verify user session
    const sessionCookie = request.cookies.get("gh_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = decryptSession(sessionCookie.value);

    // Find and update analysis
    const analysis = await Analysis.findById(id);
    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (analysis.githubId !== session.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update progress
    analysis.analysisProgress = progress;

    // Update performance metrics if provided
    if (performanceUpdate) {
      analysis.performanceMetrics = {
        ...analysis.performanceMetrics,
        ...performanceUpdate,
        timestamp: new Date(),
      };
    }

    // If analysis is complete, update lastAnalyzed
    if (progress.status === "complete") {
      analysis.lastAnalyzed = new Date();
    }

    await analysis.save();

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to update analysis progress:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
