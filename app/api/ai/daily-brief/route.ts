import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { createMaskingAdapter } from "@/lib/ai/masking";

const TASK = "daily_brief" as const;

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
    } = body;

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
      // Fallback deterministic brief in natural Thai
      const topIssue = issues[0]?.title ? `โดยมีเรื่องเร่งด่วนคือ "${issues[0].title}" ที่ควรรีบดำเนินการ` : "และไม่มีรายการปัญหาค้างชำระที่น่ากังวล";
      summaryText = `ภาพรวมสุขภาพโรงงานวันนี้อยู่ในเกณฑ์${mood === "Thriving" ? "ดีเยี่ยม" : mood === "Steady" ? "มั่นคง" : "ต้องเฝ้าระวัง"} (${healthScore}/100) มีสภาพคล่องเงินสดรองรับได้อีก ${runwayWeeks} สัปดาห์ ${topIssue} เพื่อรักษาสภาพคล่องให้อยู่เหนือเกณฑ์ปลอดภัย`;
    }

    // 4. Unmask to restore any counterparty names if masked
    const unmaskedReply = masking.unmask(summaryText.trim());

    return NextResponse.json({
      success: true,
      summary: unmaskedReply,
      asOf: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Daily brief API error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate daily brief" }, { status: 500 });
  }
}
