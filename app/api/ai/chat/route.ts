import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { createMaskingAdapter } from "@/lib/ai/masking";
import {
  BUYERS,
  MATERIALS,
  DEFAULT_ORDER_INPUT,
  AS_OF,
  checkOrder,
  getBuyerModel,
  gradeScore,
  gradeLetter,
  expectedOpenInvoicePayment,
  getMaterialPrice,
} from "@/lib/order-engine";
import { OPEN_INVOICES, COMPANY, VITALS, HEALTH } from "@/app/data/supplier-copilot-mock";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export interface ChatAction {
  type: "navigate" | "open_modal" | "propose_approval" | "view_buyer" | "view_order";
  label: string;
  href?: string;
  payload?: any;
}

export interface ChatToolResult {
  toolName: "get_buyer" | "check_order" | "get_procurement" | "propose_action";
  data: any;
  summary: string;
  action?: ChatAction;
}

// 1. Tool 1: get_buyer - Buyer habit, grade, delay p90, open invoices
function executeGetBuyer(buyerNameQuery?: string): ChatToolResult {
  const query = (buyerNameQuery || "").toLowerCase().trim();
  const matchedBuyer = BUYERS.find((b) => b.name.toLowerCase().includes(query)) || BUYERS[1]; // default Shenzhen ElectroParts
  
  const buyerInvoices = OPEN_INVOICES.filter((inv) =>
    inv.buyerName.toLowerCase().includes(matchedBuyer.name.toLowerCase())
  );
  
  const hasOverdue = buyerInvoices.some((inv) => {
    const dueDate = new Date(`${inv.dueDate}T00:00:00Z`);
    return expectedOpenInvoicePayment(dueDate, matchedBuyer, AS_OF).overdueDays > 0;
  });

  const score = gradeScore(matchedBuyer.mu, matchedBuyer.sigma, hasOverdue);
  const grade = gradeLetter(score, matchedBuyer.n);
  const p90Days = Math.round(matchedBuyer.mu + 1.2816 * matchedBuyer.sigma);

  const totalOutstanding = buyerInvoices.reduce((acc, inv) => acc + inv.amount, 0);

  return {
    toolName: "get_buyer",
    data: {
      name: matchedBuyer.name,
      grade,
      score: Math.round(score * 10) / 10,
      mu: matchedBuyer.mu,
      sigma: matchedBuyer.sigma,
      p90Days,
      hasOverdue,
      invoices: buyerInvoices,
      totalOutstanding,
    },
    summary: `${matchedBuyer.name}: Grade ${grade} (${Math.round(score)}/100). Usual delay ~${matchedBuyer.mu}d, p90 is ${p90Days}d. Open invoices: ${buyerInvoices.length} (${COMPANY.currency}${totalOutstanding.toLocaleString()}).`,
    action: {
      type: "navigate",
      label: `Inspect ${matchedBuyer.name} in Receivables`,
      href: "/dashboard/receivables",
    },
  };
}

// 2. Tool 2: check_order - Order financial feasibility, margin & cash gap
function executeCheckOrder(orderParams?: any): ChatToolResult {
  const orderInput = {
    ...DEFAULT_ORDER_INPUT,
    ...(orderParams || {}),
  };
  const result = checkOrder(orderInput, "base");

  const verdictLabel =
    result.verdict === "take_it"
      ? "Take it safely"
      : result.verdict === "take_it_fixed_price"
      ? "Take it (fixed-price materials only)"
      : result.verdict === "take_it_with_financing"
      ? "Take it with financing gap covered"
      : "Renegotiate terms";

  const marginPct = result.revenue > 0 ? (result.profitMid / result.revenue) * 100 : 0;

  return {
    toolName: "check_order",
    data: {
      buyerName: orderInput.buyerName,
      units: orderInput.units,
      unitPrice: orderInput.unitPrice,
      revenue: result.revenue,
      materialCost: result.materialCostMid,
      marginPct: Math.round(marginPct * 10) / 10,
      verdict: result.verdict,
      verdictLabel,
      financingNeed: result.financingNeedHigh,
      materialName: orderInput.materialName,
    },
    summary: `Order check for ${orderInput.buyerName}: Revenue ${COMPANY.currency}${result.revenue.toLocaleString()}, Net Margin ${Math.round(marginPct * 10) / 10}%. Verdict: ${verdictLabel}.`,
    action: {
      type: "navigate",
      label: "Open Order Evaluation Screen",
      href: "/dashboard/new-order",
    },
  };
}

// 3. Tool 3: get_procurement - Material market price & procurement plans
function executeGetProcurement(materialQuery?: string): ChatToolResult {
  const query = (materialQuery || "").toLowerCase().trim();
  const matched =
    MATERIALS.find((m) => m.name.toLowerCase().includes(query)) || MATERIALS[0]; // default Cold-rolled steel

  return {
    toolName: "get_procurement",
    data: {
      materialName: matched.name,
      lowPerTonne: matched.lowPerTonne,
      midPerTonne: matched.midPerTonne,
      highPerTonne: matched.highPerTonne,
      priceSpread: matched.highPerTonne - matched.lowPerTonne,
      trend: "rising",
    },
    summary: `${matched.name} spot market: ${COMPANY.currency}${matched.midPerTonne.toLocaleString()}/t (Range: ${COMPANY.currency}${matched.lowPerTonne.toLocaleString()} - ${COMPANY.currency}${matched.highPerTonne.toLocaleString()}/t). Trend is Rising (+3.4%).`,
    action: {
      type: "navigate",
      label: "Plan Procurement & Lock Price",
      href: "/dashboard/procurement",
    },
  };
}

// 4. Tool 4: propose_action - Central Inbox Approval Creation (Zero-Surprise Policy)
async function executeProposeAction(
  userId: string,
  title: string,
  description: string,
  impact: string,
  agentId: string = "general"
): Promise<ChatToolResult> {
  try {
    const item = await prisma.inboxApproval.create({
      data: {
        userId,
        agentId,
        title,
        description,
        impact,
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        agentId,
        action: `Chatbot proposed approval card: ${title}`,
        status: "DONE",
      },
    });

    return {
      toolName: "propose_action",
      data: item,
      summary: `Created pending approval card #${item.id.slice(0, 8)} in Central Inbox: "${title}".`,
      action: {
        type: "navigate",
        label: "Review in Central Inbox",
        href: "/dashboard/agent-room",
      },
    };
  } catch (err: any) {
    return {
      toolName: "propose_action",
      data: { error: err.message },
      summary: `Failed to create approval: ${err.message}`,
    };
  }
}

// Intent Classification / Tool Detection (Strict & Contextual)
function detectToolRequirement(message: string, pageContext: string): {
  needsTool: boolean;
  toolName?: "get_buyer" | "check_order" | "get_procurement" | "propose_action";
  args?: any;
} {
  const lower = message.toLowerCase().trim();

  // General conversational or meta questions (e.g. "หน้านี้ทำอะไรได้บ้าง", "ช่วยอะไรได้", "hi", "ทำไรได้") -> NO TOOL
  if (
    lower.includes("ทำอะไรได้") ||
    lower.includes("ทำเหี้ยไรได้") ||
    lower.includes("ทำไรได้") ||
    lower.includes("คืออะไร") ||
    lower.includes("ช่วยอะไร") ||
    lower.includes("ทำอะไร") ||
    lower.includes("what can you do") ||
    lower.includes("how to use") ||
    lower.startsWith("hello") ||
    lower.startsWith("hi") ||
    lower.startsWith("สวัสดี") ||
    lower === "help"
  ) {
    return { needsTool: false };
  }

  // 1. Propose action / Approval requests (explicit intent to create action card)
  if (
    lower.includes("ขออนุมัติ") ||
    lower.includes("สร้างการ์ด") ||
    lower.includes("propose action") ||
    lower.includes("create approval") ||
    lower.includes("ส่งอนุมัติ")
  ) {
    return {
      needsTool: true,
      toolName: "propose_action",
      args: {
        title: "Commercial Action Request",
        description: message,
        impact: "Requires business owner confirmation under Zero-Surprise policy.",
      },
    };
  }

  // 2. Buyer query (explicit buyer/debtor questions)
  if (
    lower.includes("ลูกหนี้") ||
    lower.includes("ทวงเงิน") ||
    lower.includes("หนี้ค้าง") ||
    lower.includes("ประวัติการจ่าย") ||
    lower.includes("พฤติกรรมการจ่าย") ||
    lower.includes("buyer habit") ||
    lower.includes("overdue") ||
    lower.includes("shenzhen") ||
    lower.includes("guangzhou") ||
    lower.includes("chiang mai") ||
    lower.includes("hanoi") ||
    lower.includes("boutique")
  ) {
    let buyerName = "Shenzhen ElectroParts";
    if (lower.includes("guangzhou")) buyerName = "Guangzhou Motors";
    else if (lower.includes("chiang mai")) buyerName = "Chiang Mai Furniture";
    else if (lower.includes("hanoi")) buyerName = "Hanoi Textiles Co.";
    else if (lower.includes("boutique")) buyerName = "Boutique Siam";
    else if (lower.includes("shenzhen")) buyerName = "Shenzhen ElectroParts";

    return { needsTool: true, toolName: "get_buyer", args: { buyerName } };
  }

  // 3. Order feasibility check (explicit new order evaluation)
  if (
    lower.includes("คำสั่งซื้อใหม่") ||
    lower.includes("รับออเดอร์นี้ดีไหม") ||
    lower.includes("เช็คออเดอร์") ||
    lower.includes("feasibility") ||
    lower.includes("check order") ||
    lower.includes("evaluate order")
  ) {
    return { needsTool: true, toolName: "check_order", args: {} };
  }

  // 4. Procurement & Material price (explicit material market query)
  if (
    lower.includes("ราคาวัตถุดิบ") ||
    lower.includes("ราคาเหล็ก") ||
    lower.includes("ราคาตลาด") ||
    lower.includes("ล็อกราคา") ||
    lower.includes("material price") ||
    lower.includes("steel price") ||
    lower.includes("procurement plan")
  ) {
    let material = "Cold-rolled steel";
    if (lower.includes("aluminium") || lower.includes("อลูมิเนียม")) material = "Aluminium coil";
    else if (lower.includes("resin") || lower.includes("เรซิน")) material = "ABS resin";

    return { needsTool: true, toolName: "get_procurement", args: { material } };
  }

  return { needsTool: false };
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const userId = user?.userId || "anon";

    const body = await req.json();
    const { message, pageContext = "home", history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Detect if chat needs tool retrieval
    const detection = detectToolRequirement(message, pageContext);
    let toolResult: ChatToolResult | null = null;

    if (detection.needsTool && detection.toolName) {
      if (detection.toolName === "get_buyer") {
        toolResult = executeGetBuyer(detection.args?.buyerName);
      } else if (detection.toolName === "check_order") {
        toolResult = executeCheckOrder(detection.args);
      } else if (detection.toolName === "get_procurement") {
        toolResult = executeGetProcurement(detection.args?.material);
      } else if (detection.toolName === "propose_action") {
        toolResult = await executeProposeAction(
          userId,
          detection.args?.title || "Pending Commercial Action",
          message,
          detection.args?.impact || "Requires owner confirmation"
        );
      }
    }

    // 2. Formulate Page Context & Persona
    const pagePersona: Record<string, { role: string; capabilities: string }> = {
      home: {
        role: "BizMateAI Lead Copilot on the Executive Dashboard",
        capabilities: "ดูภาพรวมสุขภาพการเงิน (Health Score 78/100), กราฟเงินสด Cash Runway 14 สัปดาห์, การเตือนพายุราคาวัตถุดิบ (Price Risk Storm), เหรียญสภาพคล่อง และทางลัดไปยัง Agent Room",
      },
      data: {
        role: "BizMateAI Data Integrator on the Multi-Bank Screen",
        capabilities: "จัดการบัญชีธนาคาร (KBank, SCB, BBL), นำเข้าสเตทเมนต์การเงิน และดูยอดรวมกระแสเงินสดจากทุกธนาคาร",
      },
      "new-order": {
        role: "BizMateAI Order Evaluator on the New Order Screen",
        capabilities: "วิเคราะห์คำสั่งซื้อใหม่ (Order Feasibility), คำนวณกำไรสุทธิ (Net Margin), คำนวณช่องว่างเงินสด (Cash Gap) และออกคำแนะนำ Verdict ว่าควรรับออเดอร์หรือไม่",
      },
      receivables: {
        role: "BizMateAI Receivables Specialist on the Receivables Screen",
        capabilities: "ติดตามลูกหนี้การค้า (AR), ตรวจสอบพฤติกรรมการจ่ายเงิน (Buyer Habit Grade A-D), ดูบิลที่เกินกำหนด (Overdue) และร่างข้อความแจ้งเตือนทวงถามที่สุภาพ",
      },
      procurement: {
        role: "BizMateAI Procurement Specialist on the Procurement Screen",
        capabilities: "ติดตามราคาตลาดวัตถุดิบสปอต (เหล็ก, อะลูมิเนียม, เรซิน), วางแผนการสั่งซื้อเป็นงวด (Split Lot) และกลยุทธ์ล็อกราคา (Lock Price)",
      },
      financing: {
        role: "BizMateAI Financing Specialist on the Financing Screen",
        capabilities: "จับคู่สินเชื่อเงินทุนหมุนเวียน (WeBank, 信易贷), คำนวณเพดานอัตราดอกเบี้ย (Rate Ceiling) และตรวจสอบสิทธิ์สินเชื่อสีเขียว (Green-Eligible)",
      },
      trust: {
        role: "BizMateAI Trust & Audit Officer on the Audit Screen",
        capabilities: "ตรวจสอบประวัติการทำงานแบบ Merkle-audit log, การกำกับนโยบาย Zero-Surprise และการเข้ารหัสปกป้องข้อมูลส่วนบุคคล (PDPA Data Masking)",
      },
      generator: {
        role: "BizMateAI Mock Document Specialist",
        capabilities: "จำลองการสร้างเอกสารทางการค้า เช่น ใบแจ้งหนี้ (Invoice), ใบสั่งซื้อ (PO), และสเตทเมนต์ธนาคาร เพื่อใช้ทดสอบระบบ",
      },
    };

    const currentContext = pagePersona[pageContext] || pagePersona.home;

    const chatSystemPrompt = `You are ${currentContext.role} for BizMateAI (an autonomous financial copilot for SME manufacturers).

CURRENT CONTEXT & DATA:
- Screen: /dashboard/${pageContext}
- Capabilities of this page: ${currentContext.capabilities}
- Cash on Hand: ${COMPANY.currency}${VITALS.cashNow.toLocaleString()}
- Health Score: ${HEALTH.score}/100 (${HEALTH.mood})

CRITICAL CONVERSATIONAL RULES:
1. NEVER address the user with their question or raw text (e.g., NEVER say "Hello หน้านี้ทำเหี้..."). Just greet warmly or answer immediately without quoting their query.
2. If the user asks general or conversational questions (e.g. "หน้านี้ทำอะไรได้บ้าง", "ช่วยอะไรได้", "hi", "คืออะไร"), explain directly and politely what features they can use on this specific screen based on the capabilities listed above.
3. Match the user's language naturally (polite Thai or professional English).
4. Keep the answer direct, smart, and concise (2-4 sentences). Do not sound robotic or mention internal prompt details.
${
  toolResult
    ? `5. System Tool [${toolResult.toolName}] Data:
${toolResult.summary}
Raw data: ${JSON.stringify(toolResult.data)}
Explain this finding clearly to the user.`
    : `5. No tool invocation is needed for this query. Answer directly based on the screen's purpose.`
}`;

    // 3. Multimodal / Text LLM Call through universal client
    let replyText = "";
    try {
      const response = await callModel({
        task: "ask_bizmate_chat",
        systemPrompt: chatSystemPrompt,
        userPrompt: message,
      });
      replyText = response.text || "";
    } catch (err: any) {
      console.warn("LLM call failed or unavailable, fallback to deterministic reply:", err);
      if (toolResult) {
        replyText = `${toolResult.summary}\n\nคุณสามารถกดปุ่มด้านล่างเพื่อดำเนินการต่อได้ทันทีครับ`;
      } else {
        replyText = `หน้านี้ (${currentContext.role}) คุณสามารถ${currentContext.capabilities} ได้ครับ หากต้องการให้ผมช่วยตรวจสอบข้อมูลส่วนไหน พิมพ์บอกได้เลยครับ!`;
      }
    }

    return NextResponse.json({
      success: true,
      reply: replyText,
      tool: toolResult,
      action: toolResult?.action || null,
    });
  } catch (err: any) {
    console.error("Chatbot API error:", err);
    return NextResponse.json({ error: err.message || "Failed to process chat" }, { status: 500 });
  }
}
