import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }

    const userId = userPayload.userId;

    // Reset user data: delete inbox items, audit logs, chat messages, chat sessions
    await prisma.$transaction([
      prisma.chatMessage.deleteMany({
        where: { session: { userId } },
      }),
      prisma.chatSession.deleteMany({
        where: { userId },
      }),
      prisma.inboxApproval.deleteMany({
        where: { userId },
      }),
      prisma.auditLog.deleteMany({
        where: { userId },
      }),
      // Re-seed PRD default inbox items
      prisma.inboxApproval.createMany({
        data: [
          {
            userId,
            agentId: "collections",
            title: "Chase overdue invoice - Boutique Siam",
            description: "Drafted polite LINE reminder for ฿35,000 invoice (21 days past due).",
            impact: "+฿35,000 cash recovery on 20 Oct",
            status: "PENDING",
            requiresFaceId: false,
          },
          {
            userId,
            agentId: "funding",
            title: "Request 60-day terms from Chen Tech",
            description: "Proposal to defer ¥100,000 payment to 25 Dec at 1.1% fee financing.",
            impact: "Preserves ฿80,000 safety buffer on 26 Oct",
            status: "PENDING",
            requiresFaceId: false,
          },
          {
            userId,
            agentId: "true-cost",
            title: "Approve Shenzhen Chen Tech FX Payment",
            description: "Direct bank rail locked to verified registry account (¥100,000).",
            impact: "-฿482,500 cash outflow scheduled for due date",
            status: "PENDING",
            requiresFaceId: true,
          },
        ],
      }),
      // Re-seed PRD default audit logs
      prisma.auditLog.createMany({
        data: [
          {
            userId,
            agentId: "trust",
            action: "System database state reset to baseline by Developer Reset Utility",
            status: "DONE",
          },
          {
            userId,
            agentId: "cash",
            action: "Ingested bank feed: Kasikornbank Main (฿245,000)",
            status: "DONE",
          },
          {
            userId,
            agentId: "true-cost",
            action: "Shenzhen Chen Tech invoice verified: No account tampering detected",
            status: "DONE",
          },
        ],
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Database state reset to default demo baseline successfully",
    });
  } catch (error) {
    console.error("Dev reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset database state" },
      { status: 500 }
    );
  }
}
