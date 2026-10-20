import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { checkRateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    // Key by IP + email to prevent targeted brute-force attacks while minimizing collateral lockout
    const rateLimitKey = `${clientIp}:${normalizedEmail}`;
    const rateCheck = checkRateLimit(rateLimitKey, "auth_login");

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

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Successful login: reset the failed attempt counter
    resetRateLimit(rateLimitKey, "auth_login");

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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected internal server error occurred." },
      { status: 500 }
    );
  }
}
