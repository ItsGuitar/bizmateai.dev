import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeBankId } from "@/lib/financial-service";

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const bankId = normalizeBankId(searchParams.get("bankId") || "kbank");

    // Fallback: If not logged in or demo mode, return empty list or default
    if (!user) {
      return NextResponse.json({ scenarios: [] });
    }

    const scenarios = await prisma.whatIfScenario.findMany({
      where: {
        userId: user.userId,
        bankId,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error("Failed to fetch what-if scenarios:", error);
    return NextResponse.json(
      { error: "Failed to fetch what-if scenarios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, weekIndex, amount, bankId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Scenario name is required" }, { status: 400 });
    }

    const parsedWeekIndex = Number(weekIndex);
    if (isNaN(parsedWeekIndex) || parsedWeekIndex < 0 || parsedWeekIndex > 12) {
      return NextResponse.json({ error: "Week must be between W1 and W13" }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const validBankId = normalizeBankId(bankId || "kbank");
    const scenarioType = type === "INFLOW" ? "INFLOW" : "OUTFLOW";
    const weekLabel = `W${parsedWeekIndex + 1}`;

    const scenario = await prisma.whatIfScenario.create({
      data: {
        userId: user.userId,
        bankId: validBankId,
        name: name.trim(),
        type: scenarioType,
        weekIndex: parsedWeekIndex,
        weekLabel,
        amount: parsedAmount,
        isEnabled: true,
      },
    });

    return NextResponse.json({ scenario }, { status: 201 });
  } catch (error) {
    console.error("Failed to create what-if scenario:", error);
    return NextResponse.json(
      { error: "Failed to create what-if scenario" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, isEnabled } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Scenario ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.whatIfScenario.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const updated = await prisma.whatIfScenario.update({
      where: { id },
      data: {
        isEnabled: typeof isEnabled === "boolean" ? isEnabled : !existing.isEnabled,
      },
    });

    return NextResponse.json({ scenario: updated });
  } catch (error) {
    console.error("Failed to toggle what-if scenario:", error);
    return NextResponse.json(
      { error: "Failed to toggle what-if scenario" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Scenario ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.whatIfScenario.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    await prisma.whatIfScenario.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Failed to delete what-if scenario:", error);
    return NextResponse.json(
      { error: "Failed to delete what-if scenario" },
      { status: 500 }
    );
  }
}
