import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFinancialSummary, normalizeBankId, BANK_DATASETS } from "@/lib/financial-service";

// Helper to re-generate inbox items for all active (enabled) banks
async function syncInboxProposalsForUser(userId: string) {
  // Clear pending proposals
  await prisma.inboxApproval.deleteMany({
    where: { userId, status: "PENDING" },
  });

  // Get all active bank connections
  const activeConns = await prisma.userBankConnection.findMany({
    where: { userId, isEnabled: true },
  });

  const activeBankIds = activeConns.map((c) => c.bankId);
  const effectiveBankIds = activeBankIds.length > 0 ? activeBankIds : ["kbank"];

  const newProposals: Array<{
    userId: string;
    agentId: string;
    title: string;
    description: string;
    impact: string;
    status: string;
    requiresFaceId: boolean;
  }> = [];

  for (const bId of effectiveBankIds) {
    const summary = getFinancialSummary(bId);
    const debtor = summary.buyerHabits[0];
    const supplier = summary.supplierHistory;

    if (debtor && debtor.currentOverdueAmount > 0) {
      newProposals.push({
        userId,
        agentId: "collections",
        title: `Chase overdue invoice - ${debtor.name} (${summary.company})`,
        description: `Drafted polite reminder for ฿${debtor.currentOverdueAmount.toLocaleString()} invoice (${debtor.averageDelayDays} days average delay).`,
        impact: `+฿${debtor.currentOverdueAmount.toLocaleString()} cash recovery`,
        status: "PENDING",
        requiresFaceId: false,
      });
    }

    if (supplier && supplier.totalOrdersCount > 0 && supplier.pendingOrderAmount > 0) {
      newProposals.push({
        userId,
        agentId: "funding",
        title: `Request 60-day terms from ${supplier.name} (${summary.company})`,
        description: `Proposal to defer ${supplier.pendingOrderCurrency || "¥"}${supplier.pendingOrderAmount.toLocaleString()} payment to preserve cash buffer.`,
        impact: `Preserves ฿${summary.safetyBuffer.toLocaleString()} safety buffer`,
        status: "PENDING",
        requiresFaceId: false,
      });

      newProposals.push({
        userId,
        agentId: "true-cost",
        title: `Approve ${supplier.name} FX Payment (${summary.company})`,
        description: `Direct bank rail locked to verified registry account (${supplier.pendingOrderCurrency || "¥"}${supplier.pendingOrderAmount.toLocaleString()}).`,
        impact: `-฿${Math.round(supplier.pendingOrderAmount * 4.825).toLocaleString()} cash outflow scheduled for due date`,
        status: "PENDING",
        requiresFaceId: true,
      });
    } else if (summary.isPersonal) {
      newProposals.push({
        userId,
        agentId: "funding",
        title: `Personal Cash Reserve Auto-Sweep (${summary.company})`,
        description: `Set up automated ฿5,000 sweep to high-yield digital savings whenever balance exceeds ฿${summary.safetyBuffer.toLocaleString()}.`,
        impact: `Guarantees emergency fund buffer of ฿${summary.safetyBuffer.toLocaleString()}`,
        status: "PENDING",
        requiresFaceId: false,
      });
    }
  }

  if (newProposals.length > 0) {
    await prisma.inboxApproval.createMany({
      data: newProposals,
    });
  }

  return newProposals.length;
}

// GET: List all bank connections for user
export async function GET(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let connections = await prisma.userBankConnection.findMany({
      where: { userId: auth.userId },
      orderBy: { linkedAt: "asc" },
    });

    // If user has zero connections in db, auto-seed with kbank default
    if (connections.length === 0) {
      const config = BANK_DATASETS.kbank;
      const initialConn = await prisma.userBankConnection.create({
        data: {
          userId: auth.userId,
          bankId: "kbank",
          bankName: config.bankName,
          companyName: config.defaultCompany,
          isEnabled: true,
        },
      });
      connections = [initialConn];
    }

    return NextResponse.json({
      connections,
    });
  } catch (error) {
    console.error("Fetch bank connections error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Add or link a new bank connection
export async function POST(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bankId } = await request.json();
    const normalized = normalizeBankId(bankId);
    const config = BANK_DATASETS[normalized] || BANK_DATASETS.kbank;

    // Upsert into UserBankConnection
    const connection = await prisma.userBankConnection.upsert({
      where: {
        userId_bankId: {
          userId: auth.userId,
          bankId: normalized,
        },
      },
      create: {
        userId: auth.userId,
        bankId: normalized,
        bankName: config.bankName,
        companyName: config.defaultCompany,
        isEnabled: true,
      },
      update: {
        isEnabled: true,
      },
    });

    const proposalsCount = await syncInboxProposalsForUser(auth.userId);

    return NextResponse.json({
      success: true,
      connection,
      statementCompany: config.defaultCompany,
      proposalsCount,
    });
  } catch (error) {
    console.error("Link bank error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Toggle bank connection status or Open All
export async function PATCH(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bankId, isEnabled, action } = await request.json();

    if (action === "OPEN_ALL") {
      await prisma.userBankConnection.updateMany({
        where: { userId: auth.userId },
        data: { isEnabled: true },
      });

      const updated = await prisma.userBankConnection.findMany({
        where: { userId: auth.userId },
        orderBy: { linkedAt: "asc" },
      });

      const proposalsCount = await syncInboxProposalsForUser(auth.userId);

      return NextResponse.json({
        success: true,
        connections: updated,
        proposalsCount,
      });
    }

    // Toggle specific bank
    const normalized = normalizeBankId(bankId);

    // Guard: Must keep at least 1 bank enabled
    if (isEnabled === false) {
      const activeCount = await prisma.userBankConnection.count({
        where: { userId: auth.userId, isEnabled: true },
      });
      if (activeCount <= 1) {
        return NextResponse.json(
          { error: "Must keep at least 1 bank account active. Cannot disable all banks." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.userBankConnection.update({
      where: {
        userId_bankId: {
          userId: auth.userId,
          bankId: normalized,
        },
      },
      data: { isEnabled: Boolean(isEnabled) },
    });

    const proposalsCount = await syncInboxProposalsForUser(auth.userId);

    const allConnections = await prisma.userBankConnection.findMany({
      where: { userId: auth.userId },
      orderBy: { linkedAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      connection: updated,
      connections: allConnections,
      proposalsCount,
    });
  } catch (error) {
    console.error("Patch bank connection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
