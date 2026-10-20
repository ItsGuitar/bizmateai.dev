import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

// Password must be at least 8 characters long and contain both letters and numbers
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(clientIp, "auth_register");

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.message,
          code: "RATE_LIMIT_EXCEEDED",
          resetInSeconds: rateCheck.resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.resetInSeconds),
          },
        }
      );
    }

    const { email, password, businessName } = await request.json();

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Valid email and password are required." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and contain at least one letter and one number.",
        },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fallbackName = businessName?.trim() || trimmedEmail.split("@")[0];

    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
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
      { error: "An unexpected internal server error occurred." },
      { status: 500 }
    );
  }
}
