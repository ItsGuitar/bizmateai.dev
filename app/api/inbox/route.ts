import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch pending or all approval inbox items for the user
export async function GET(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const bankConnected = searchParams.get("bankConnected") === "true";

    const totalCount = await prisma.inboxApproval.count({
      where: { userId: auth.userId },
    });

    // Only auto-seed AI proposals once the bank has been connected and statement analyzed
    if (bankConnected) {
      const defaultProposals = [
        {
          userId: auth.userId,
          agentId: "collections",
          title: "Chase overdue invoice - Boutique Siam",
          description: "Drafted polite LINE reminder for ฿35,000 invoice (21 days past due).",
          impact: "+฿35,000 cash recovery on 20 Oct",
          status: "PENDING",
          requiresFaceId: false,
        },
        {
          userId: auth.userId,
          agentId: "funding",
          title: "Request 60-day terms from Chen Tech",
          description: "Proposal to defer ¥100,000 payment to 25 Dec at 1.1% fee financing.",
          impact: "Preserves ฿80,000 safety buffer on 26 Oct",
          status: "PENDING",
          requiresFaceId: false,
        },
        {
          userId: auth.userId,
          agentId: "true-cost",
          title: "Approve Shenzhen Chen Tech FX Payment",
          description: "Direct bank rail locked to verified registry account (¥100,000).",
          impact: "-฿482,500 cash outflow scheduled for due date",
          status: "PENDING",
          requiresFaceId: true,
        },
      ];

      // Check existing items to avoid race conditions and duplicates
      const existing = await prisma.inboxApproval.findMany({
        where: { userId: auth.userId },
        select: { agentId: true, title: true },
      });

      const itemsToCreate = defaultProposals.filter(
        (dp) => !existing.some((e) => e.agentId === dp.agentId && e.title === dp.title)
      );

      if (itemsToCreate.length > 0) {
        await prisma.inboxApproval.createMany({
          data: itemsToCreate,
        });
      }
    }

    const items = await prisma.inboxApproval.findMany({
      where: {
        userId: auth.userId,
        status: status === "ALL" ? undefined : status,
      },
      orderBy: { createdAt: "desc" },
    });

    const [pendingCount, approvedCount, declinedCount, totalItemsCount] = await Promise.all([
      prisma.inboxApproval.count({ where: { userId: auth.userId, status: "PENDING" } }),
      prisma.inboxApproval.count({ where: { userId: auth.userId, status: "APPROVED" } }),
      prisma.inboxApproval.count({ where: { userId: auth.userId, status: "DECLINED" } }),
      prisma.inboxApproval.count({ where: { userId: auth.userId } }),
    ]);

    return NextResponse.json({
      items,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        declined: declinedCount,
        all: totalItemsCount,
      },
    });
  } catch (error) {
    console.error("Inbox GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Approve or decline an action (Deterministic Guardrail Axiom 2 & 3)
export async function POST(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId, action, biometricVerified } = await request.json();

    if (!itemId || !["APPROVE", "DECLINE"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid approval action" },
        { status: 400 }
      );
    }

    const item = await prisma.inboxApproval.findFirst({
      where: { id: itemId, userId: auth.userId },
    });

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    }

    // Server-enforced biometric guardrail check
    if (item.requiresFaceId && action === "APPROVE" && !biometricVerified) {
      return NextResponse.json(
        { error: "Biometric step-up (Face ID) is strictly required for this transaction." },
        { status: 403 }
      );
    }

    // Update item status
    const updatedItem = await prisma.inboxApproval.update({
      where: { id: itemId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "DECLINED",
      },
    });

    // Write to immutable audit log (TR-01 parity)
    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        agentId: item.agentId,
        action: `User ${action === "APPROVE" ? "approved" : "declined"} action: ${item.title}${item.requiresFaceId ? " (Face ID Verified)" : ""}`,
        status: action === "APPROVE" ? "DONE" : "BLOCKED",
      },
    });

    return NextResponse.json({
      success: true,
      item: updatedItem,
      message: `Action successfully ${action.toLowerCase()}d.`,
    });
  } catch (error) {
    console.error("Inbox POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
