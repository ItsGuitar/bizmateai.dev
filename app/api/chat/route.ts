import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callGeminiOrFallback } from "@/lib/gemini-service";

// GET: Fetch all chat sessions or messages for a session
export async function GET(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: auth.userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      return NextResponse.json({ session });
    }

    // List all sessions
    const sessions = await prisma.chatSession.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Send message, generate multi-agent response with Google Gemini AI, and persist history
export async function POST(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, sessionId, bankId: requestBankId } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Find or create session
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          userId: auth.userId,
          title: message.slice(0, 35) + (message.length > 35 ? "..." : ""),
        },
      });
      targetSessionId = newSession.id;
    }

    // Load recent history in session for context
    const previousMessages = await prisma.chatMessage.findMany({
      where: { sessionId: targetSessionId },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: { senderType: true, content: true },
    });

    // 1. Save User Message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId: targetSessionId,
        senderType: "USER",
        content: message,
      },
    });

    // Fetch user details for personalized context
    const dbUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { businessName: true, email: true },
    });

    const activeBusinessName = dbUser?.businessName || auth.businessName;
    const effectiveBankId = requestBankId || activeBusinessName;

    // 2. Multi-Agent Reasoning via Google Gemini AI / Deterministic Multi-Agent Fallback (Axiom 1 & 4)
    const agentResult = await callGeminiOrFallback(
      message,
      previousMessages,
      undefined,
      {
        businessName: activeBusinessName,
        email: dbUser?.email || auth.email,
      },
      effectiveBankId
    );

    // 3. Save Agent Response
    const agentMessage = await prisma.chatMessage.create({
      data: {
        sessionId: targetSessionId,
        senderType: "AGENT",
        agentId: agentResult.agentId,
        content: agentResult.content,
        reasoning: agentResult.reasoning,
        actionRoute: agentResult.actionRoute,
      },
    });

    return NextResponse.json({
      sessionId: targetSessionId,
      userMessage,
      agentMessage,
    });
  } catch (error) {
    console.error("Chat POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
