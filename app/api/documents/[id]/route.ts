import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

async function resolveUserId(req: Request): Promise<string> {
  const user = getUserFromRequest(req);
  if (user?.userId) return user.userId;
  const firstUser = await prisma.user.findFirst();
  return firstUser?.id || "";
}

// PATCH: Update document properties (e.g. isEnabled, counterparty, amount, dates)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.ingestedDocument.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const updated = await prisma.ingestedDocument.update({
      where: { id },
      data: {
        ...(body.isEnabled !== undefined && { isEnabled: Boolean(body.isEnabled) }),
        ...(body.counterparty !== undefined && { counterparty: String(body.counterparty) }),
        ...(body.docNumber !== undefined && { docNumber: String(body.docNumber) }),
        ...(body.amount !== undefined && { amount: Number(body.amount) }),
        ...(body.currency !== undefined && { currency: String(body.currency) }),
        ...(body.issueDate !== undefined && { issueDate: String(body.issueDate) }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? String(body.dueDate) : null }),
        ...(body.termsDays !== undefined && { termsDays: Number(body.termsDays) }),
        ...(body.docType !== undefined && { docType: String(body.docType) }),
      },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (err: any) {
    console.error("Error updating document:", err);
    return NextResponse.json({ error: err.message || "Failed to update document" }, { status: 500 });
  }
}

// DELETE: Remove document from Canonical Data Model
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    const { id } = await params;

    const existing = await prisma.ingestedDocument.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await prisma.ingestedDocument.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        agentId: "receivables",
        action: `Deleted document ${existing.docNumber} (${existing.counterparty})`,
        status: "DONE",
      },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("Error deleting document:", err);
    return NextResponse.json({ error: err.message || "Failed to delete document" }, { status: 500 });
  }
}
