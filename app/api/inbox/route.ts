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

    const items = await prisma.inboxApproval.findMany({
      where: {
        userId: auth.userId,
        status: status === "ALL" ? undefined : status,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
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
