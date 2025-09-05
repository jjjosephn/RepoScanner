import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: { repository_Id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Full params object:", params);
    console.log("Available param keys:", Object.keys(params));

    const { repository_Id: repositoryId } = params;

    console.log(
      `API route received repository_Id: "${params.repository_Id}", converted to repositoryId: "${repositoryId}"`
    );

    // Return early if repository ID is undefined or invalid
    if (
      !repositoryId ||
      repositoryId === "undefined" ||
      repositoryId === "null" ||
      repositoryId.trim() === ""
    ) {
      console.log(
        `Invalid repository ID: "${repositoryId}", returning empty results`
      );
      return NextResponse.json({ secrets: [], dependencies: [] });
    }

    console.log(
      `Valid repository ID: "${repositoryId}", proceeding with backend call`
    );

    // Get scan results from Python backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const response = await fetch(
      `${backendUrl}/api/scan/results/${repositoryId}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Backend responded with status: ${response.status}`);
      if (response.status === 404) {
        return NextResponse.json({ secrets: [], dependencies: [] });
      }
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Scan results for repository ${repositoryId}:`, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching scan results:", error);
    return NextResponse.json(
      { secrets: [], dependencies: [] },
      { status: 200 }
    );
  }
}
