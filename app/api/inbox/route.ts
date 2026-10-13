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

    const bankId = searchParams.get("bankId") || undefined;

    // Only auto-seed AI proposals once the bank has been connected and user currently has 0 items
    if (bankConnected && totalCount === 0) {
      const { getFinancialSummary } = await import("@/lib/financial-service");
      const summary = getFinancialSummary(bankId);
      const debtor = summary.buyerHabits[0];
      const supplier = summary.supplierHistory;

      const defaultProposals = [];

      if (debtor && debtor.currentOverdueAmount > 0) {
        defaultProposals.push({
          userId: auth.userId,
          agentId: "collections",
          title: `Chase overdue invoice - ${debtor.name}`,
          description: `Drafted polite reminder for ฿${debtor.currentOverdueAmount.toLocaleString()} invoice (${debtor.averageDelayDays} days average delay).`,
          impact: `+฿${debtor.currentOverdueAmount.toLocaleString()} cash recovery`,
          status: "PENDING",
          requiresFaceId: false,
        });
      }

      if (supplier && supplier.totalOrdersCount > 0 && supplier.pendingOrderAmount > 0) {
        defaultProposals.push({
          userId: auth.userId,
          agentId: "funding",
          title: `Request 60-day terms from ${supplier.name}`,
          description: `Proposal to defer ${supplier.pendingOrderCurrency || "¥"}${supplier.pendingOrderAmount.toLocaleString()} payment to preserve cash buffer.`,
          impact: `Preserves ฿${summary.safetyBuffer.toLocaleString()} safety buffer`,
          status: "PENDING",
          requiresFaceId: false,
        });

        defaultProposals.push({
          userId: auth.userId,
          agentId: "true-cost",
          title: `Approve ${supplier.name} FX Payment`,
          description: `Direct bank rail locked to verified registry account (${supplier.pendingOrderCurrency || "¥"}${supplier.pendingOrderAmount.toLocaleString()}).`,
          impact: `-฿${Math.round(supplier.pendingOrderAmount * 4.825).toLocaleString()} cash outflow scheduled for due date`,
          status: "PENDING",
          requiresFaceId: true,
        });
      } else if (summary.isPersonal) {
        defaultProposals.push({
          userId: auth.userId,
          agentId: "funding",
          title: "Personal Cash Reserve Auto-Sweep",
          description: `Set up automated ฿5,000 sweep to high-yield digital savings whenever balance exceeds ฿${summary.safetyBuffer.toLocaleString()}.`,
          impact: `Guarantees emergency fund buffer of ฿${summary.safetyBuffer.toLocaleString()}`,
          status: "PENDING",
          requiresFaceId: false,
        });
      }

      if (defaultProposals.length > 0) {
        await prisma.inboxApproval.createMany({
          data: defaultProposals,
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
