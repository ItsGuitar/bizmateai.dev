import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password, businessName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        businessName: businessName || "Ploy Select Co., Ltd.",
        // Seed initial Approval Inbox items matching PRD instruction.md
        inboxItems: {
          create: [
            {
              agentId: "collections",
              title: "Chase overdue invoice - Boutique Siam",
              description: "Drafted polite LINE reminder for ฿35,000 invoice (21 days past due).",
              impact: "+฿35,000 cash recovery on 20 Oct",
              requiresFaceId: false,
            },
            {
              agentId: "funding",
              title: "Request 60-day terms from Chen Tech",
              description: "Proposal to defer ¥100,000 payment to 25 Dec at 1.1% fee financing.",
              impact: "Preserves ฿80,000 safety buffer on 26 Oct",
              requiresFaceId: false,
            },
            {
              agentId: "true-cost",
              title: "Approve Shenzhen Chen Tech FX Payment",
              description: "Direct bank rail locked to verified registry account (¥100,000).",
              impact: "-฿482,500 cash outflow scheduled for due date",
              requiresFaceId: true,
            },
          ],
        },
        // Seed initial immutable audit logs matching PRD instruction.md
        auditLogs: {
          create: [
            {
              agentId: "trust",
              action: "Enforced read-only bank connection boundaries",
              status: "DONE",
            },
            {
              agentId: "cash",
              action: "Detected ¥100,000 shortfall risk against ฿80,000 buffer for week of 26 Oct",
              status: "FLAGGED",
            },
            {
              agentId: "true-cost",
              action: "Flagged and blocked predatory 1% daily loan advertisement (APR > 365%)",
              status: "BLOCKED",
            },
          ],
        },
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      businessName: user.businessName,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        businessName: user.businessName,
      },
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
