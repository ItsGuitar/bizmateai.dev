import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logs = await prisma.auditLog.findMany({
      where: { userId: auth.userId },
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Audit log GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
