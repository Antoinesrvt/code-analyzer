// src/app/api/analysis/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Analysis } from "@/models/Analysis";
import { decryptSession } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Verify user session
    const sessionCookie = request.cookies.get("gh_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = decryptSession(sessionCookie.value);

    // Find analysis
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

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to fetch analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Verify user session
    const sessionCookie = request.cookies.get("gh_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = decryptSession(sessionCookie.value);

    // Find analysis
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

    await analysis.deleteOne();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete analysis:", error);
    return NextResponse.json(
      { error: "Failed to delete analysis" },
      { status: 500 }
    );
  }
}
