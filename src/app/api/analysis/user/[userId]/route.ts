// src/app/api/analysis/user/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Analysis } from "@/models/Analysis";
import { decryptSession } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy") || "lastAnalyzed";
    const order = searchParams.get("order") || "desc";

    // Verify user session
    const sessionCookie = request.cookies.get("gh_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = decryptSession(sessionCookie.value);

    // Build query
    const query: any = { userId };
    if (status) {
      query["analysisProgress.status"] = status;
    }

    // Fetch analyses with pagination
    const analyses = await Analysis.find(query)
      .sort({ [sortBy]: order === "desc" ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Analysis.countDocuments(query);

    return NextResponse.json({
      analyses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch user analyses:", error);
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 }
    );
  }
}
