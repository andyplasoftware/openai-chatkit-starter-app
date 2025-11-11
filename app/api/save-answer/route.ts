import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { answer, questionId, userId } = await request.json();
    
    if (!answer) {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 }
      );
    }
    
    const bubbleApiKey = process.env.BUBBLE_API_KEY;
    const bubbleApiUrl = process.env.BUBBLE_API_URL;
    
    if (!bubbleApiKey || !bubbleApiUrl) {
      console.error("Missing Bubble.io configuration");
      return NextResponse.json(
        { error: "Missing Bubble.io configuration" },
        { status: 500 }
      );
    }

    // Call your Bubble.io API
    // Adjust the endpoint and payload structure based on your Bubble.io API setup
    const response = await fetch(`${bubbleApiUrl}/api/1.1/obj/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bubbleApiKey}`,
      },
      body: JSON.stringify({
        answer_text: answer,
        question_id: questionId || "",
        user_id: userId || "",
        // Add any other fields your Bubble.io API expects
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Bubble.io API error:", error);
      return NextResponse.json(
        { error: error.error || "Failed to save answer" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Save answer error:", error);
    return NextResponse.json(
      { error: "Failed to save answer" },
      { status: 500 }
    );
  }
}

