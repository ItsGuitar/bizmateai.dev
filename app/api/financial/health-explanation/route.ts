import { NextResponse } from "next/server";
import { getFinancialSummary, getMultiBankFinancialSummary, HealthScoreFactor } from "@/lib/financial-service";

interface HealthExplanationRequest {
  bankId?: string;
  bankIds?: string[];
  locale?: "th" | "en";
}

export interface HealthExplanationResponse {
  score: number;
  ratingGrade: string;
  creditStatus: string;
  isAuditableRuleBased: true;
  summaryExecutive: string;
  encouragingFeedback: string;
  pillarInsights: Array<{
    pillar: string;
    score: number;
    status: string;
    humanExplanation: string;
    actionableAdvice: string;
  }>;
}

// Deterministic rule-based statistical analysis generator with conversational, human-friendly tone
function generateFallbackExplanation(
  overallScore: number,
  ratingGrade: string,
  creditStatus: string,
  factors: HealthScoreFactor[],
  companyName: string,
  locale: "th" | "en" = "th"
): HealthExplanationResponse {
  const isThai = locale === "th";

  // Identify strongest and weakest pillars from deterministic stats
  const sortedFactors = [...factors].sort((a, b) => b.score - a.score);
  const strongest = sortedFactors[0];
  const weakest = sortedFactors[sortedFactors.length - 1];

  let summaryExecutive = "";
  let encouragingFeedback = "";

  if (isThai) {
    summaryExecutive = `ภาพรวมสุขอนามัยทางการเงินของ ${companyName} อยู่ในเกณฑ์ ${ratingGrade} (${overallScore}/100) ถือว่าอยู่ในกลุ่มธุรกิจที่มีระเบียบวินัยการเงินแข็งแกร่ง จุดเด่นหลักคือ "${strongest.name}" ที่ได้คะแนนสูงถึง ${strongest.score}/100 สะท้อนความน่าเชื่อถือสูงมากต่อสถาบันการเงิน`;
    encouragingFeedback = `คุณบริหารจัดการธุรกิจได้ยอดเยี่ยมมากครับ! โดยเฉพาะการรักษาวินัยการหมุนเวียนเงิน แม้มีจุดที่ต้องปรับปรุงเล็กน้อยในด้าน "${weakest.name}" แต่หากทำตามข้อแนะนำทีละสเต็ป สุขภาพการเงินของคุณจะสามารถเลื่อนขึ้นสู่ระดับ Grade A ได้อย่างมั่นคงแน่นอน`;
  } else {
    summaryExecutive = `Overall financial hygiene for ${companyName} stands at ${ratingGrade} (${overallScore}/100), placing your business in a high-credit tier. Your primary anchor is "${strongest.name}" with a score of ${strongest.score}/100, proving high creditworthiness to commercial lenders.`;
    encouragingFeedback = `You are running a remarkably disciplined operation! With just targeted fine-tuning in "${weakest.name}", your business can effortlessly step up to top-tier Grade A terms.`;
  }

  const pillarInsights = factors.map((f) => {
    let humanExplanation = "";
    let actionableAdvice = "";

    if (f.name.includes("Overdraft") || f.name.includes("Hygiene")) {
      humanExplanation = isThai
        ? "ไม่มีประวัติเงินติดลบหรือเช็คเด้งเลยแม้แต่ครั้งเดียว ซึ่งเป็นสิ่งที่ธนาคารให้ความสำคัญเป็นอันดับหนึ่ง"
        : "Zero overdrafts or bounced checks recorded across the entire statement period, representing prime banking conduct.";
      actionableAdvice = isThai
        ? "รักษาประวัติการไม่เกิดยอดติดลบต่อไปเพื่อคงเกรดพรีเมียมนี้ไว้"
        : "Maintain this clean track record to safeguard prime lending rates.";
    } else if (f.name.includes("Debt-to-Income") || f.name.includes("Stability")) {
      humanExplanation = isThai
        ? "กระแสเงินสดขาเข้าสามารถรองรับค่าใช้จ่ายและภาระหนี้ได้อย่างสมดุลต่อเนื่อง"
        : "Operating cash inflows consistently comfortably cover ongoing obligations and supplier debits.";
      actionableAdvice = isThai
        ? "ควบคุมต้นทุนคงที่และบริหารรอบการจ่ายเงินไม่ให้กระจุกตัวในสัปดาห์เดียว"
        : "Smooth out recurring overhead to prevent single-week liquidity crunches.";
    } else if (f.name.includes("Trade") || f.name.includes("Supplier")) {
      humanExplanation = isThai
        ? "ประวัติการชำระเงินให้คู่ค้ามีหลักฐานชัดเจน ตรวจสอบย้อนหลังได้ครบถ้วน"
        : "Documented trade payment settlements with verified counterparties validate real commercial activity.";
      actionableAdvice = isThai
        ? "ใช้ช่องทางโอนเงินคู่ค้าที่ได้รับการรับรองผ่านระบบต่อไป เพื่อใช้ยืนยันขอเครดิตเทอม 60 วัน"
        : "Continue transacting through verified partner rails to negotiate 60-day deferred supplier terms.";
    } else if (f.name.includes("Channel") || f.name.includes("Revenue")) {
      humanExplanation = isThai
        ? "รายได้มาจากหลายช่องทางขาย (Shopee, TikTok, Lazada, หน้าร้าน QR) ช่วยลดความเสี่ยงจากการพึ่งพาแพลตฟอร์มใดแพลตฟอร์มหนึ่ง"
        : "Revenue inflows are healthily diversified across e-commerce channels and retail stall PromptPay QR.";
      actionableAdvice = isThai
        ? "กระจายยอดขายและดึงเงินเข้ารายวันเพื่อรักษาคะแนนความหลากหลายของช่องทาง"
        : "Keep expanding omnichannel touchpoints to strengthen overall resilience.";
    } else if (f.name.includes("Debtor") || f.name.includes("Recovery")) {
      humanExplanation = isThai
        ? "มีลูกหนี้การค้าบางรายที่ชำระล่าช้ากว่ากำหนด ซึ่งทำให้คะแนนในแกนนี้ถูกลดทอนลงไปเล็กน้อย"
        : "A portion of customer receivables is currently overdue, representing internal liquidity tied up with buyers.";
      actionableAdvice = isThai
        ? "ส่งข้อความเตือนสุภาพผ่าน LINE OA ในระบบ Collections Agent เพื่อดึงเงินสดกลับเข้ามาทันที"
        : "Dispatch friendly courtesy reminders via the Collections Agent to accelerate recovery.";
    } else if (f.name.includes("Buffer") || f.name.includes("Discipline")) {
      humanExplanation = isThai
        ? "เงินสดสำรองส่วนใหญ่รักษาระดับเหนือ Safety Buffer ได้ดี มีเพียงบางช่วงที่ยอดจ่ายชนกัน"
        : "Operational cash reserves generally satisfy the configured safety buffer threshold.";
      actionableAdvice = isThai
        ? "เลื่อนการจ่ายเงินก้อนใหญ่ให้คู่ค้าด้วยการขอเครดิตเทอม 60 วัน เพื่อไม่ให้เงินลดลงต่ำกว่าเกณฑ์"
        : "Leverage 60-day supplier deferrals during peak inventory weeks to preserve the buffer.";
    } else {
      humanExplanation = isThai
        ? "ระบบตรวจจับและสกัดกั้นการโอนผิดบัญชีหรือข้อเสนอเงินกู้ดอกเบี้ยเกินจริงได้อย่างปลอดภัย 100%"
        : "Risk defense filters successfully prevented account spoofing and predatory loan exposures.";
      actionableAdvice = isThai
        ? "ให้ True Cost Agent ตรวจสอบบัญชีปลายทางและอัตราดอกเบี้ยจริงเสมอก่อนอนุมัติจ่ายเงิน"
        : "Let True Cost Agent audit recipient accounts and effective APR before every transfer.";
    }

    return {
      pillar: f.name,
      score: f.score,
      status: f.status,
      humanExplanation,
      actionableAdvice,
    };
  });

  return {
    score: overallScore,
    ratingGrade,
    creditStatus,
    isAuditableRuleBased: true,
    summaryExecutive,
    encouragingFeedback,
    pillarInsights,
  };
}

export async function POST(request: Request) {
  try {
    const body: HealthExplanationRequest = await request.json().catch(() => ({}));
    const bankId = body.bankId;
    const bankIds = body.bankIds;
    const locale = body.locale || "th";

    // 1. STATISTICAL CREDIT SCORING (RULE-BASED AUDITABLE ENGINE - STRICTLY NO BLACK BOX LLM FOR SCORE)
    let summary;
    if (bankIds && bankIds.length > 1) {
      summary = getMultiBankFinancialSummary(bankIds);
    } else {
      summary = getFinancialSummary(bankId);
    }

    const { overallScore, ratingGrade, creditStatus, factors } = summary.healthScore;
    const companyName = summary.company;

    // 2. GENERATIVE AI (LLM) FOR NATURAL, ENCOURAGING & EXPLAINABLE HUMAN INSIGHTS
    const apiKey = process.env.GEMINI_API_KEY;
    const isApiKeyValid = apiKey && apiKey.trim() !== "" && apiKey !== "abcde";

    if (isApiKeyValid) {
      try {
        const prompt = `You are the BizMateAI Health Agent, an empathetic, highly professional, and encouraging financial advisor for SMEs.
The credit score calculation is 100% deterministic rule-based (statistical credit scoring matrix running on the server). Your task is NOT to calculate or alter any numbers, but to EXPLAIN the numbers in empathetic, natural, human-friendly ${locale === "th" ? "Thai" : "English"} that builds confidence for the SME owner.

AUDITED STATISTICAL DATA (Strictly Grounded, Do Not Change):
- Company: ${companyName}
- Overall Score: ${overallScore}/100 (${ratingGrade})
- Tier Status: ${creditStatus}
- 7 Hygiene Pillars:
${factors.map((f, i) => `${i + 1}. ${f.name}: ${f.score}/100 (${f.status}) - Evidence: ${f.evidence}`).join("\n")}

REQUIREMENTS:
1. Provide a warm, constructive executive summary explaining the overall health score.
2. Provide an encouraging note highlighting what they do well and giving clear confidence.
3. For each of the 7 pillars, provide:
   - "humanExplanation": A plain-language explanation of what this score means for their daily business.
   - "actionableAdvice": A simple, concrete recommendation they can do next.
4. Language: Natural, polite ${locale === "th" ? "Thai (ครับ)" : "English"}.
5. Return STRICTLY a valid JSON object matching this schema without markdown fences:
{
  "summaryExecutive": "...",
  "encouragingFeedback": "...",
  "pillarInsights": [
    {
      "pillar": "...",
      "score": number,
      "status": "...",
      "humanExplanation": "...",
      "actionableAdvice": "..."
    }
  ]
}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1200,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.summaryExecutive && parsed.pillarInsights) {
              return NextResponse.json({
                score: overallScore,
                ratingGrade,
                creditStatus,
                isAuditableRuleBased: true,
                summaryExecutive: parsed.summaryExecutive,
                encouragingFeedback: parsed.encouragingFeedback || parsed.summaryExecutive,
                pillarInsights: parsed.pillarInsights,
              });
            }
          }
        }
      } catch (llmErr) {
        console.warn("LLM API call failed or timed out, gracefully falling back to deterministic explanation:", llmErr);
      }
    }

    // 3. DETERMINISTIC GRACEFUL FALLBACK (If LLM is offline or no API key)
    const fallbackResponse = generateFallbackExplanation(
      overallScore,
      ratingGrade,
      creditStatus,
      factors,
      companyName,
      locale
    );

    return NextResponse.json(fallbackResponse);
  } catch (error) {
    console.error("Health explanation API error:", error);
    return NextResponse.json(
      { error: "Failed to generate health explanation" },
      { status: 500 }
    );
  }
}
