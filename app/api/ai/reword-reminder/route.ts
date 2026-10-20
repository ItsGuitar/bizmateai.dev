import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { createMaskingAdapter } from "@/lib/ai/masking";
import { requireUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

const TASK = "reword_reminder" as const;

export async function POST(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to draft reminders." },
        { status: 401 }
      );
    }

    const rateCheck = checkRateLimit(userId, "ai_reword");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.message,
          code: "RATE_LIMIT_EXCEEDED",
          resetInSeconds: rateCheck.resetInSeconds,
          readableLimit: rateCheck.readableLimit,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.resetInSeconds),
          },
        }
      );
    }

    const body = await req.json();
    const {
      buyerName,
      invoiceNumber,
      amount,
      currency = "¥",
      dueDate,
      overdueDays = 0,
      language = "English",
      channel = "Email",
      tone = "Polite and relationship-focused",
    } = body;

    if (!buyerName || !invoiceNumber || amount === undefined) {
      return NextResponse.json({ error: "Missing required financial fields" }, { status: 400 });
    }

    // 1. Client/Server-side Data Masking (PDPA & Privacy Protection)
    const masking = createMaskingAdapter();
    const maskedBuyer = masking.mask("buyer", buyerName, "Buyer Name");

    // 2. Build Guardrailed System Prompt for Receivables Agent
    const extraInstructions = `You are the Receivables Specialist Agent for BizMateAI.
Your role: Draft or reword a polite, highly professional payment reminder for an outstanding invoice.
Target language: ${language}.
Delivery channel: ${channel} (format appropriately: Email should have Subject & Body, LINE/WeChat should be conversational, concise and respectful).
Tone: ${tone}.
Crucial rules:
- Strictly adhere to commercial relationship preservation. Never use threatening, hostile, or aggressive legal wording.
- Clearly and accurately state the exact financial facts:
  * Invoice Number: ${invoiceNumber}
  * Amount: ${currency}${Number(amount).toLocaleString()}
  * Due Date: ${dueDate}
  * Overdue Status: ${overdueDays > 0 ? `${overdueDays} days overdue` : "Due soon"}
- Refer to the buyer as "${maskedBuyer}".
- Output ONLY the reminder text ready to be sent. Do not include markdown meta-commentary or conversational filler.`;

    const systemPrompt = buildSystemPrompt(extraInstructions);

    const userPrompt = `Please draft the payment reminder for ${maskedBuyer} regarding invoice ${invoiceNumber} (${currency}${Number(amount).toLocaleString()}) due on ${dueDate} (${overdueDays} days overdue). Format specifically for ${channel} in ${language}.`;

    // 3. Multimodal / Text LLM Call through universal audited client
    const { text, model } = await callModel({
      task: TASK,
      systemPrompt,
      userPrompt,
    });

    // 4. Unmask to restore real buyer name before sending back to user
    const unmaskedReply = masking.unmask(text);

    return NextResponse.json({
      success: true,
      model,
      draftText: unmaskedReply,
      meta: {
        buyerName,
        invoiceNumber,
        amount,
        currency,
        dueDate,
        overdueDays,
        language,
        channel,
      },
    });
  } catch (err: any) {
    console.error("AI Reword Reminder Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate reminder draft" },
      { status: 500 }
    );
  }
}
