// Dev-only route: proves the Phase 0 foundation end to end. Masks a sample draft-reminder
// request the same way a real screen would, sends only the masked version to the model under the
// core guardrails, then unmasks the reply before it would ever reach a screen. Not wired to any
// production page; this is purely to verify the adapter and guardrails work before anything in
// the UI depends on them. Strictly disabled in production.

import { NextResponse } from "next/server";
import { MASKING_DEMO } from "@/app/data/trust-mock";
import { createMaskingAdapter } from "@/lib/ai/masking";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { recordAiCall } from "@/lib/ai/call-log";

const TASK = "chat" as const;

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Dev endpoints are disabled in production mode." },
      { status: 403 }
    );
  }

  const adapter = createMaskingAdapter();

  const byField = Object.fromEntries(MASKING_DEMO.mapping.map((m) => [m.field, m.real]));
  const companyToken = adapter.mask("company", byField["Company"], "Company");
  const buyerToken = adapter.mask("buyer", byField["Buyer"], "Buyer");
  adapter.mask("contact", byField["Contact"], "Contact", buyerToken);
  adapter.mask("tax_id", byField["Tax ID"], "Tax ID");
  adapter.mask("bank_account", byField["Bank account"], "Bank account");
  adapter.mask("phone", byField["Phone"], "Phone");
  adapter.mask("email", byField["Email"], "Email");

  const maskedTask = {
    task: "draft_reminder",
    company: companyToken,
    buyer: buyerToken,
    invoice_no: MASKING_DEMO.lastPayload.invoice_no,
    amount: MASKING_DEMO.lastPayload.amount,
    overdue_days: MASKING_DEMO.lastPayload.overdue_days,
    tone: MASKING_DEMO.lastPayload.tone,
  };
  const maskedPrompt = `Draft one firm, polite reminder sentence to ${maskedTask.buyer} about invoice ${maskedTask.invoice_no} for ${maskedTask.amount}, ${maskedTask.overdue_days} days overdue. Sign off as ${maskedTask.company}. Use the tokens exactly as given, don't translate or expand them.`;
  const systemPrompt = buildSystemPrompt();

  try {
    const result = await callModel({ task: TASK, systemPrompt, userPrompt: maskedPrompt });
    const unmaskedReply = adapter.unmask(result.text);

    return NextResponse.json({
      ok: true,
      model: result.model,
      temperature: result.temperature,
      maskedPrompt,
      mapping: adapter.mapping,
      maskedReply: result.text,
      unmaskedReply,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
