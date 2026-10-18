import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { runDeterministicPipeline } from "@/lib/calculation-pipeline";

// POST: Trigger deterministic 7-stage calculation chain on user's documents
export async function POST(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    // Fetch all active or requested documents
    const documents = await prisma.ingestedDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const pipelineDocs = documents.map((doc) => ({
      id: doc.id,
      docNumber: doc.docNumber,
      docType: doc.docType,
      counterparty: doc.counterparty,
      amount: doc.amount,
      currency: doc.currency,
      issueDate: doc.issueDate,
      dueDate: doc.dueDate,
      termsDays: doc.termsDays || 30,
      isEnabled: doc.isEnabled,
    }));

    const activeCount = pipelineDocs.filter((d) => d.isEnabled).length;

    // Run deterministic calculation engine
    const calculationResult = await runDeterministicPipeline(pipelineDocs, {
      asOf: body.asOf || "2026-10-17",
      openingCash: body.openingCash || 1260000,
      safetyCushion: body.safetyCushion || 980000,
      monthlyFixedCosts: body.monthlyFixedCosts || 180000,
    });

    // Save calculation snapshot to database
    await prisma.calculationSnapshot.upsert({
      where: { userId },
      update: {
        resultJson: JSON.stringify(calculationResult),
        activeCount,
        calculatedAt: new Date(),
      },
      create: {
        userId,
        resultJson: JSON.stringify(calculationResult),
        activeCount,
        calculatedAt: new Date(),
      },
    });

    // Save audit log entry for calculation run
    await prisma.auditLog.create({
      data: {
        userId,
        agentId: "lead",
        action: `Executed 7-stage financial calculation chain over ${activeCount} active documents`,
        status: "DONE",
      },
    });

    return NextResponse.json({
      success: true,
      result: calculationResult,
      activeCount,
    });
  } catch (err: any) {
    console.error("Calculation pipeline error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute calculation chain" },
      { status: 500 }
    );
  }
}

// GET: Fetch latest calculation snapshot for user
export async function GET(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const snapshot = await prisma.calculationSnapshot.findUnique({
      where: { userId },
    });

    // Count currently active documents
    const activeCount = await prisma.ingestedDocument.count({
      where: { userId, isEnabled: true },
    });

    if (!snapshot || activeCount === 0) {
      return NextResponse.json({
        success: true,
        hasCalculation: false,
        activeCount,
        result: null,
      });
    }

    const parsedResult = JSON.parse(snapshot.resultJson);

    return NextResponse.json({
      success: true,
      hasCalculation: true,
      activeCount,
      result: parsedResult,
      calculatedAt: snapshot.calculatedAt,
    });
  } catch (err: any) {
    console.error("Fetch calculation snapshot error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch calculation snapshot" },
      { status: 500 }
    );
  }
}

