import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

async function resolveUserId(req: Request): Promise<string> {
  const user = getUserFromRequest(req);
  if (user?.userId) return user.userId;
  const firstUser = await prisma.user.findFirst();
  return firstUser?.id || "";
}

// GET: Fetch all approval items for the central inbox
export async function GET(req: Request) {
  try {
    const userId = await resolveUserId(req);
    const approvals = await prisma.inboxApproval.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, approvals });
  } catch (err: any) {
    console.error("Inbox GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create a new approval card (Zero-surprise policy)
export async function POST(req: Request) {
  try {
    const userId = await resolveUserId(req);
    const body = await req.json();
    const { agentId = "receivables", title, description, impact, requiresFaceId = false } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });
    }

    const item = await prisma.inboxApproval.create({
      data: {
        userId,
        agentId,
        title,
        description,
        impact: impact || "Pending owner approval",
        status: "PENDING",
        requiresFaceId,
      },
    });

    // Also record in central AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        agentId,
        action: `Created approval card: ${title}`,
        status: "DONE",
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    console.error("Inbox POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
