import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { getFinancialSummary } from "@/lib/financial-service";

// Autonomous multi-agent response logic referencing mock_financial_statement_365d.json
function generateAgentResponse(userQuery: string) {
  const query = userQuery.toLowerCase();
  const summary = getFinancialSummary();
  const conflictWeek = summary.cashRadarWeeks.find((w) => w.status === "below") || summary.cashRadarWeeks[2];

  if (query.includes("cash") || query.includes("buffer") || query.includes("balance") || query.includes("radar")) {
    return {
      agentId: "cash",
      content:
        `Based on your 13-week Cash Radar (analyzed from ${summary.totalTransactionsInStatement} statement transactions), your current cash balance today is ${summary.formattedCurrentCash}. On ${conflictWeek.date} 2026 (${conflictWeek.week}), the ¥100,000 supplier invoice to Shenzhen Chen Tech will cause your cash to dip to ฿${conflictWeek.balance.toLocaleString()}, breaching your ฿${summary.safetyBuffer.toLocaleString()} safety buffer unless remediated.`,
      reasoning:
        `Cash Agent ingested daily rolling transactions across Shopee, TikTok Shop, Lazada, and PromptPay QR from bank statement. Flagged ฿${conflictWeek.balance.toLocaleString()} deficit breach on ${conflictWeek.date}.`,
      actionRoute: "/dashboard#joint-plan",
    };
  }

  if (query.includes("supplier") || query.includes("chen") || query.includes("loan") || query.includes("fund")) {
    const supplier = summary.supplierHistory;
    return {
      agentId: "funding",
      content:
        `Your statement confirms ${supplier.monthsActive} months of verified trade with ${supplier.name} (${supplier.totalTransfersCount} historical transfers totaling ¥${supplier.totalCnySpent.toLocaleString()}). For the pending ¥${supplier.pendingOrderCny.toLocaleString()} order due on 26 Oct, the cheapest remedy is requesting 60-day deferred terms at a 1.1% fee (~฿5,000), avoiding high-interest bank debt (7.5% - 14% APR).`,
      reasoning:
        "Funding Agent cross-referenced verified cross-border ledger rails with export credit terms. Drafted bilingual term negotiation in Inbox.",
      actionRoute: "/dashboard#joint-plan",
    };
  }

  if (query.includes("invoice") || query.includes("owed") || query.includes("collect") || query.includes("remind")) {
    const overdueDebtor = summary.buyerHabits.find((b) => b.habit === "HABITUAL_LATE") || summary.buyerHabits[1];
    return {
      agentId: "collections",
      content:
        `${overdueDebtor.name} has 1 overdue invoice of ฿${overdueDebtor.currentOverdueAmount.toLocaleString()} (${Math.round(overdueDebtor.averageDelayDays)} days past due). Statement history shows they habitually settle after a polite reminder. I have drafted a LINE follow-up in your Inbox awaiting your approval.`,
      reasoning:
        `Collections Agent profiled payment latency from 12-month statement history (average delay ${overdueDebtor.averageDelayDays.toFixed(1)} days). Zero-Surprise policy requires owner sign-off.`,
      actionRoute: "/dashboard#inbox-approvals",
    };
  }

  if (query.includes("apr") || query.includes("fee") || query.includes("safe") || query.includes("scam") || query.includes("cost")) {
    return {
      agentId: "true-cost",
      content:
        `True Cost Agent inspected your transactions and intercepted ${summary.anomaliesCount} security threats: 1) A predatory loan solicitation advertising '1%/day' was calculated at 365%/year APR and blocked. 2) A spoofed offshore Hong Kong bank account attempting to impersonate Shenzhen Chen Tech was intercepted and blocked.`,
      reasoning:
        "True Cost Agent calculates effective APR and verifies recipient BIC/SWIFT against registered supplier registry.",
      actionRoute: "/dashboard#activity-stream",
    };
  }

  return {
    agentId: "health",
    content:
      `Your Financial Health Score is ${summary.healthScore.overallScore}/100 (${summary.healthScore.ratingGrade}). Key strengths: Zero overdraft incidents across 366 days and 12-month verified trade history with Shenzhen Chen Tech. Primary drag: Boutique Siam late payments.`,
    reasoning:
      "Health Agent aggregated 7 dimensions from statement transactions: liquidity hygiene, debtor habits, and cross-border trade longevity.",
    actionRoute: "/dashboard#health-score",
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
