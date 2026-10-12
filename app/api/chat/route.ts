import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Autonomous multi-agent response logic based on PRD instruction.md
function generateAgentResponse(userQuery: string) {
  const query = userQuery.toLowerCase();

  if (query.includes("cash") || query.includes("buffer") || query.includes("balance") || query.includes("radar")) {
    return {
      agentId: "cash",
      content:
        "Based on your 13-week Cash Radar, your current balance is ฿245,000. However, on the week of 26 Oct 2026, the ¥100,000 supplier invoice to Shenzhen Chen Tech will cause your cash to dip below the ฿80,000 safety buffer (projected balance: ~฿54,000) unless we take action.",
      reasoning:
        "Cash Agent parsed bank balances and projected daily inflows/outflows across Shopee, Lazada, and TikTok Shop. Triggered buffer deficit alert.",
      actionRoute: "/cash-radar",
    };
  }

  if (query.includes("supplier") || query.includes("chen") || query.includes("loan") || query.includes("fund")) {
    return {
      agentId: "funding",
      content:
        "I have evaluated 6 financing options. The cheapest path is requesting 60-day supplier credit terms directly from Mr. Chen (Shenzhen Chen Tech) with a 1.1% trade fee (~฿5,000), compared to commercial bank lines (7.5% - 14% APR). I have prepared a bilingual negotiation draft in Inbox for your sign-off.",
      reasoning:
        "Funding Agent evaluated total cost of capital. Identified Chinese export credit route as lowest APR option. Prepared inbox approval item.",
      actionRoute: "/inbox",
    };
  }

  if (query.includes("invoice") || query.includes("owed") || query.includes("collect") || query.includes("remind")) {
    return {
      agentId: "collections",
      content:
        "Boutique Siam owes ฿35,000, now 21 days past due. Their historical profile indicates they always pay after a polite follow-up. I've drafted a friendly LINE reminder in your Inbox for your OK.",
      reasoning:
        "Collections Agent evaluated AR aging ledger and customer habit profile. Zero-Surprise policy strictly holds outbound reminder dispatch until approved.",
      actionRoute: "/inbox",
    };
  }

  if (query.includes("apr") || query.includes("fee") || query.includes("safe") || query.includes("scam") || query.includes("cost")) {
    return {
      agentId: "true-cost",
      content:
        "I unpack hidden costs and inspect risks. Any external financing offers claiming '1% per day' have an actual APR of 365%/year and are automatically flagged as predatory. For Chen Tech, verified payment rails lock bank account details to prevent tampering.",
      reasoning:
        "True Cost Agent calculates effective annualized percentage rates and verifies bank recipient authenticity against trade records.",
      actionRoute: "/true-cost",
    };
  }

  return {
    agentId: "health",
    content:
      "Your current Financial Health Score is 78/100 (Grade B+). All 6 agents are collaborating to protect your ฿80,000 liquidity buffer and optimize supplier financing with Shenzhen Chen Tech.",
    reasoning:
      "Health Agent aggregated 7 business dimensions: credit history, sales stability, and supplier verification.",
    actionRoute: "/health",
  };
}

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

// POST: Send message, generate multi-agent response, and persist history
export async function POST(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, sessionId } = await request.json();

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

    // 1. Save User Message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId: targetSessionId,
        senderType: "USER",
        content: message,
      },
    });

    // 2. Multi-Agent Reasoning & Response (Glass Box AI Axiom 1)
    const agentResult = generateAgentResponse(message);

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
