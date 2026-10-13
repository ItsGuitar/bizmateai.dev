import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }

    const userId = userPayload.userId;

    // Reset user data: delete inbox items, audit logs, chat messages, chat sessions
    await prisma.$transaction([
      prisma.chatMessage.deleteMany({
        where: { session: { userId } },
      }),
      prisma.chatSession.deleteMany({
        where: { userId },
      }),
      prisma.inboxApproval.deleteMany({
        where: { userId },
      }),
      prisma.auditLog.deleteMany({
        where: { userId },
      }),
      // Re-seed initial Trust Agent baseline audit log
      prisma.auditLog.createMany({
        data: [
          {
            userId,
            agentId: "trust",
            action: "System database reset to unlinked baseline. Bank connection required.",
            status: "DONE",
          },
        ],
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Database state reset to default demo baseline successfully",
    });
  } catch (error) {
    console.error("Dev reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset database state" },
      { status: 500 }
    );
  }
}
