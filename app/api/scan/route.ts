import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { repositoryIds } = await request.json();

    console.log("Frontend sent repositoryIds:", repositoryIds);
    console.log("Type of repositoryIds:", typeof repositoryIds);
    console.log("Is array:", Array.isArray(repositoryIds));
    console.log("Length:", repositoryIds?.length);

    // Forward scan request to Python backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const requestBody = {
      repositoryIds,
      githubToken: session.accessToken,
    };

    console.log("Sending to backend:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${backendUrl}/api/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error("Failed to start scan");
    }

    const result = await response.json();
    console.log("Backend response:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error starting scan:", error);
    return NextResponse.json(
      { error: "Failed to start scan" },
      { status: 500 }
    );
  }
}
