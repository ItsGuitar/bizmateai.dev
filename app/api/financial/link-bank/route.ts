import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFinancialSummary, normalizeBankId } from "@/lib/financial-service";

export async function POST(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bankId } = await request.json();
    const normalized = normalizeBankId(bankId);
    const summary = getFinancialSummary(normalized);

    // 1. Clear out any previous inbox proposals from old bank sessions
    await prisma.inboxApproval.deleteMany({
      where: { userId: auth.userId },
    });

    // 3. Dynamically compute proposals solely based on the newly ingested statement
    const debtor = summary.buyerHabits[0];
    const supplier = summary.supplierHistory;

    const newProposals = [];

    if (debtor && debtor.currentOverdueAmount > 0) {
      newProposals.push({
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
      newProposals.push({
        userId: auth.userId,
        agentId: "funding",
        title: `Request 60-day terms from ${supplier.name}`,
        description: `Proposal to defer ${supplier.pendingOrderCurrency || "¥"}${supplier.pendingOrderAmount.toLocaleString()} payment to preserve cash buffer.`,
        impact: `Preserves ฿${summary.safetyBuffer.toLocaleString()} safety buffer`,
        status: "PENDING",
        requiresFaceId: false,
      });

      newProposals.push({
        userId: auth.userId,
        agentId: "true-cost",
        title: `Approve ${supplier.name} FX Payment`,
        description: `Direct bank rail locked to verified registry account (${supplier.pendingOrderCurrency || "¥"}${supplier.pendingOrderAmount.toLocaleString()}).`,
        impact: `-฿${Math.round(supplier.pendingOrderAmount * 4.825).toLocaleString()} cash outflow scheduled for due date`,
        status: "PENDING",
        requiresFaceId: true,
      });
    } else if (summary.isPersonal) {
      newProposals.push({
        userId: auth.userId,
        agentId: "funding",
        title: "Personal Cash Reserve Auto-Sweep",
        description: `Set up automated ฿5,000 sweep to high-yield digital savings whenever balance exceeds ฿${summary.safetyBuffer.toLocaleString()}.`,
        impact: `Guarantees emergency fund buffer of ฿${summary.safetyBuffer.toLocaleString()}`,
        status: "PENDING",
        requiresFaceId: false,
      });
    }

    if (newProposals.length > 0) {
      await prisma.inboxApproval.createMany({
        data: newProposals,
      });
    }

    return NextResponse.json({
      success: true,
      businessName: summary.company,
      proposalsCount: newProposals.length,
    });
  } catch (error) {
    console.error("Link bank error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
