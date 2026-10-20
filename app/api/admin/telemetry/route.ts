import { NextResponse } from "next/server";
import { getAllAiCalls, clearAiLogs } from "@/lib/ai/call-log";
import { MODEL_NAME } from "@/lib/ai/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

function getAdminPin(): string {
  const pin = process.env.ADMIN_PIN;
  if (!pin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PIN environment variable must be set in production.");
    }
    return "bizmate-admin-2026";
  }
  return pin;
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`admin:${clientIp}`, "auth_login");

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many failed attempts. Admin endpoint locked temporarily.",
          code: "RATE_LIMIT_EXCEEDED",
          resetInSeconds: rateCheck.resetInSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.resetInSeconds) },
        }
      );
    }

    const body = await request.json();
    const { pin, action } = body;

    const correctPin = getAdminPin();
    if (!pin || pin !== correctPin) {
      return NextResponse.json({ ok: false, error: "Unauthorized: Invalid PIN." }, { status: 401 });
    }

    if (action === "clear") {
      clearAiLogs();
      return NextResponse.json({ ok: true, message: "Logs cleared." });
    }

    const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
    const logs = getAllAiCalls();

    return NextResponse.json({
      ok: true,
      systemStatus: {
        aiConnected: hasApiKey,
        configuredModel: MODEL_NAME,
        timestamp: new Date().toISOString(),
        totalLogs: logs.length,
      },
      logs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error handling admin request";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
