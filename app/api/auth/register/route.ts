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
    const fallbackName = businessName?.trim() || email.split("@")[0];
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        businessName: fallbackName,
        // Seed initial immutable audit logs matching PRD instruction.md
        auditLogs: {
          create: [
            {
              agentId: "trust",
              action: "Enforced read-only bank connection boundaries",
              status: "DONE",
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
