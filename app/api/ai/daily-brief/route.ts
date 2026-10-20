import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { createMaskingAdapter } from "@/lib/ai/masking";
import { requireUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import crypto from "crypto";

const TASK = "daily_brief" as const;

// Server-side in-memory cache keyed by calculation fingerprint
// Preserves Gemini API limits across browser reloads and repeated navigations (TTL: 6 hours)
interface CachedEntry {
  summary: string;
  timestamp: number;
}
const briefCache = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function POST(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to generate daily brief." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      healthScore = 78,
      mood = "Thriving",
      factoryLevel = 4,
      cashNow = 0,
      runwayWeeks = 14,
      safetyCushion = 500000,
      financingNeed = 0,
      issues = [],
      language = "English",
      forceRefresh = false,
    } = body;

    // 0. Compute deterministic fingerprint of input data
    const inputFingerprint = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          healthScore,
          mood,
          factoryLevel,
          cashNow: Math.round(cashNow / 1000), // round to nearest thousand to absorb micro-jitter
          runwayWeeks,
          safetyCushion,
          financingNeed: Math.round(financingNeed / 1000),
          issueIds: issues.map((i: any) => `${i.id || i.title}:${i.severity}`).sort(),
          language,
        })
      )
      .digest("hex");

    // Check server-side memory cache (saves Gemini limit on page refresh or tab re-opening)
    if (!forceRefresh) {
      const cached = briefCache.get(inputFingerprint);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json({
          success: true,
          summary: cached.summary,
          asOf: new Date(cached.timestamp).toISOString(),
          cached: true,
        });
      }
    } else {
      // Force refresh requested: rate limit check to prevent cache busting abuse
      const rateCheck = checkRateLimit(userId, "ai_brief");
      if (!rateCheck.allowed) {
        // Fall back to cached entry if available, otherwise return 429
        const cached = briefCache.get(inputFingerprint);
        if (cached) {
          return NextResponse.json({
            success: true,
            summary: cached.summary,
            asOf: new Date(cached.timestamp).toISOString(),
            cached: true,
            warning: rateCheck.message,
          });
        }

        return NextResponse.json(
          {
            error: rateCheck.message,
            code: "RATE_LIMIT_EXCEEDED",
            resetInSeconds: rateCheck.resetInSeconds,
          },
          {
            status: 429,
            headers: { "Retry-After": String(rateCheck.resetInSeconds) },
          }
        );
      }
    }

    // 1. Client/Server-side Data Masking for any party names in issues (PDPA Protection)
    const masking = createMaskingAdapter();
    const maskedIssues = issues.map((iss: any) => {
      let maskedTitle = iss.title || "";
      let maskedDetail = iss.detail || "";

      // Mask buyer or vendor names if detected in titles
      const knownParties = ["Guangzhou Motors", "Shenzhen EV Battery", "Dongguan Electronics", "Apex Craft Furniture", "BioHarvest"];
      for (const p of knownParties) {
        if (maskedTitle.includes(p)) {
          const token = masking.mask("buyer", p, "Counterparty");
          maskedTitle = maskedTitle.replaceAll(p, token);
        }
        if (maskedDetail.includes(p)) {
          const token = masking.mask("buyer", p, "Counterparty");
          maskedDetail = maskedDetail.replaceAll(p, token);
        }
      }

      return {
        ...iss,
        title: maskedTitle,
        detail: maskedDetail,
      };
    });

    // 2. Build Guardrailed System Prompt for Daily Brief Synthesis
    const extraInstructions = `You are the Lead Financial Copilot for BizMateAI.
Your role: Synthesize the current health and top operational priorities into a clear, executive daily brief.
Target language: ${language}.
Tone: Calm, clear, authoritative, and actionable. Avoid financial panic jargon.
Crucial rules:
- Ground all observations strictly in the provided health score, cash runway, and ranked issues.
- Never hallucinate non-existent loans or suppliers.
- Format with concise bullet points or bold headers: (1) Current Status, (2) Priority Attention Item, (3) Recommended Action.
- Do not output preamble or conversational greetings. Jump directly into the brief.`;

    const systemPrompt = buildSystemPrompt(extraInstructions);

    const promptPayload = {
      healthScore,
      mood,
      factoryLevel,
      cashNow,
      runwayWeeks,
      safetyCushion,
      financingNeed,
      issues: maskedIssues.slice(0, 3), // Focus on top 3 most critical items
    };

    const userPrompt = `Synthesize today's executive daily brief based on these company metrics:\n${JSON.stringify(promptPayload, null, 2)}`;

    // 3. Multimodal / Text LLM Call through universal audited client
    const { text, model } = await callModel({
      task: TASK,
      systemPrompt,
      userPrompt,
    });

    // 4. Unmask to restore real party names before sending back to user
    const unmaskedReply = masking.unmask(text);

    // 5. Store in memory cache
    briefCache.set(inputFingerprint, {
      summary: unmaskedReply,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      summary: unmaskedReply,
      model,
      asOf: new Date().toISOString(),
      cached: false,
    });
  } catch (error: any) {
    console.error("daily-brief error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate daily brief" },
      { status: 500 }
    );
  }
}
