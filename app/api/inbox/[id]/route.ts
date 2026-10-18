import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

// PATCH: owner approves or declines a proposed action from the inbox / agent room.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const status = body.status === "APPROVED" || body.status === "DECLINED" ? body.status : null;

    if (!status) {
      return NextResponse.json({ error: "status must be APPROVED or DECLINED" }, { status: 400 });
    }

    const existing = await prisma.inboxApproval.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    const item = await prisma.inboxApproval.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        agentId: existing.agentId,
        action: `${status === "APPROVED" ? "Approved" : "Declined"}: ${existing.title}`,
        status: status === "APPROVED" ? "DONE" : "FLAGGED",
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    console.error("Inbox PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
