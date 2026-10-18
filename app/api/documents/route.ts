import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { sha256Hex, GENESIS_HASH } from "@/lib/audit-chain";

// GET: Fetch all ingested documents for current user
export async function GET(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const documents = await prisma.ingestedDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, documents });
  } catch (err: any) {
    console.error("Error fetching documents:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch documents" }, { status: 500 });
  }
}

// POST: Save a newly confirmed document into the Canonical Data Model (CDM)
export async function POST(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();

    const {
      fileName,
      docType,
      counterparty,
      docNumber,
      amount,
      currency,
      issueDate,
      dueDate,
      termsDays,
      itemsJson,
    } = body;

    if (!docNumber || !counterparty || amount === undefined) {
      return NextResponse.json({ error: "Missing required document fields" }, { status: 400 });
    }

    // Compute tamper-evident audit hash linked to last document
    const lastDoc = await prisma.ingestedDocument.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const prevHash = lastDoc?.auditHash || GENESIS_HASH;
    const auditPayload = JSON.stringify([
      userId,
      docNumber,
      counterparty,
      amount,
      issueDate,
      prevHash,
    ]);
    const auditHash = await sha256Hex(auditPayload);

    const newDoc = await prisma.ingestedDocument.create({
      data: {
        userId,
        fileName: fileName || `${docNumber}.png`,
        docType: docType || "invoice",
        counterparty,
        docNumber,
        amount: Number(amount) || 0,
        currency: currency || "¥",
        issueDate: issueDate || new Date().toISOString().split("T")[0],
        dueDate: dueDate || null,
        termsDays: termsDays ? Number(termsDays) : 30,
        itemsJson: typeof itemsJson === "string" ? itemsJson : JSON.stringify(itemsJson || []),
        isEnabled: true,
        verifiedStatus: "verified",
        auditHash,
      },
    });

    // Also record in central AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        agentId: "receivables",
        action: `Ingested ${docType || "document"} ${docNumber} (${counterparty})`,
        status: "DONE",
      },
    });

    return NextResponse.json({ success: true, document: newDoc });
  } catch (err: any) {
    console.error("Error saving document:", err);
    return NextResponse.json({ error: err.message || "Failed to save document" }, { status: 500 });
  }
}
