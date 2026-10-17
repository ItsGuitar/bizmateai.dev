import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { createMaskingAdapter } from "@/lib/ai/masking";
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
      language = "Thai",
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
    }

    // 1. Client/Server-side Data Masking for any party names in issues (PDPA Protection)
    const masking = createMaskingAdapter();
    const maskedIssues = issues.map((iss: any) => {
      let maskedTitle = iss.title || "";
      let maskedDetail = iss.detail || "";

      // Mask common counterparty tokens if found
      if (iss.counterparty) {
        const token = masking.mask("buyer", iss.counterparty, "Buyer");
        maskedTitle = maskedTitle.replace(new RegExp(iss.counterparty, "g"), token);
        maskedDetail = maskedDetail.replace(new RegExp(iss.counterparty, "g"), token);
      }

      return {
        severity: iss.severity,
        title: maskedTitle,
        detail: maskedDetail,
        agent: iss.agent,
      };
    });

    // 2. Build Guardrailed System Prompt for Daily Brief Narrative
    const extraInstructions = `You are the Lead Copilot Agent for BizMateAI (an autonomous financial copilot for SME manufacturers).
Your task is: "Explain the Daily Brief" (สรุปสถานการณ์ประจำวันหน้า Home).

MANDATORY RULES:
1. Explain the numbers as a natural, cohesive story in plain, conversational language.
2. STRICTLY NO COMPLEX TECHNICAL JARGON (ห้ามใช้ศัพท์เทคนิคซับซ้อน เช่น standard deviation, credibility shrinkage, p90, dso ฯลฯ ให้แปลเป็นคำพูดที่เจ้าของโรงงานหรือผู้ประกอบการเข้าใจง่าย).
3. STRICT LIMIT: No more than 3 concise lines/sentences (ความยาวไม่เกิน 3 บรรทัด).
4. Tone: Confident, encouraging, professional, and practical.
5. Language: ${language === "English" ? "English" : "Natural, polite Thai (ภาษาไทย)"}.
6. Use only the provided calculated numbers:
   - Health Score: ${healthScore}/100 (${mood}, Factory Level ${factoryLevel}/5)
   - Current Cash: ¥${Number(cashNow).toLocaleString()}
   - Runway: ~${runwayWeeks} weeks (Safety cushion ¥${Number(safetyCushion).toLocaleString()})
   - Financing Need: ¥${Number(financingNeed).toLocaleString()}
   - Priority Issues: ${maskedIssues.length > 0 ? JSON.stringify(maskedIssues.slice(0, 3)) : "None"}

OUTPUT FORMAT:
Output ONLY the clean 2-3 sentence summary paragraph. Do not include markdown headers, bullet lists, asterisks, or quotes.`;

    const systemPrompt = buildSystemPrompt(extraInstructions);

    const userPrompt = `Please synthesize the factory daily brief based on Health Score ${healthScore} (${mood}), Cash ¥${Number(cashNow).toLocaleString()}, Runway ${runwayWeeks}w, and ${maskedIssues.length} active issues. Format in at most 3 concise, natural lines.`;

    // 3. Multimodal / Text LLM Call through audited client
    let summaryText = "";
    try {
      const response = await callModel({
        task: TASK,
        systemPrompt,
        userPrompt,
      });
      summaryText = response.text || "";
    } catch (err: any) {
      console.warn("LLM daily brief fallback:", err);
      // Fallback deterministic brief in natural language
      if (language === "English") {
        const topIssue = issues[0]?.title
          ? `Priority attention is required for "${issues[0].title}".`
          : "No immediate payment bottlenecks are detected.";
        summaryText = `Overall factory financial health remains ${mood} (${healthScore}/100) with liquidity runway covering ${runwayWeeks} weeks. ${topIssue} Maintain operational cushion above safety thresholds.`;
      } else {
        const topIssue = issues[0]?.title
          ? `โดยมีเรื่องเร่งด่วนคือ "${issues[0].title}" ที่ควรรีบดำเนินการ`
          : "และไม่มีรายการปัญหาค้างชำระที่น่ากังวล";
        summaryText = `ภาพรวมสุขภาพโรงงานวันนี้อยู่ในเกณฑ์${mood === "Thriving" ? "ดีเยี่ยม" : mood === "Steady" ? "มั่นคง" : "ต้องเฝ้าระวัง"} (${healthScore}/100) มีสภาพคล่องเงินสดรองรับได้อีก ${runwayWeeks} สัปดาห์ ${topIssue} เพื่อรักษาสภาพคล่องให้อยู่เหนือเกณฑ์ปลอดภัย`;
      }
    }

    // 4. Unmask to restore any counterparty names if masked
    const unmaskedReply = masking.unmask(summaryText.trim());

    // Save into server-side memory cache
    briefCache.set(inputFingerprint, {
      summary: unmaskedReply,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      summary: unmaskedReply,
      asOf: new Date().toISOString(),
      cached: false,
    });
  } catch (err: any) {
    console.error("Daily brief API error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate daily brief" }, { status: 500 });
  }
}
