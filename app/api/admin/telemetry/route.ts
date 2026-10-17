import { NextResponse } from "next/server";
import { getAllAiCalls, clearAiLogs } from "@/lib/ai/call-log";
import { MODEL_NAME } from "@/lib/ai/config";

// Hardcoded backend secret PIN as requested
const ADMIN_SECRET_PIN = "12345678";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin, action } = body;

    if (pin !== ADMIN_SECRET_PIN) {
      return NextResponse.json({ ok: false, error: "Unauthorized: Invalid PIN" }, { status: 401 });
    }

    if (action === "clear") {
      clearAiLogs();
      return NextResponse.json({ ok: true, message: "Logs cleared" });
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
