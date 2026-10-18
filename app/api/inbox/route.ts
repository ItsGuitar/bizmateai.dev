import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { createApproval } from "@/lib/inbox";

// GET: Fetch all approval items for the central inbox
export async function GET(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { agentId = "receivables", title, description, impact, requiresFaceId = false } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });
    }

    const item = await createApproval({ userId, agentId, title, description, impact, requiresFaceId });

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    console.error("Inbox POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
