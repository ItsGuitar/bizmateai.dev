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

// Intent Classification / Tool Detection
function detectToolRequirement(message: string, pageContext: string): {
  needsTool: boolean;
  toolName?: "get_buyer" | "check_order" | "get_procurement" | "propose_action";
  args?: any;
} {
  const lower = message.toLowerCase();

  // 1. Propose action / Approval requests
  if (
    lower.includes("ขออนุมัติ") ||
    lower.includes("สร้างการ์ด") ||
    lower.includes("propose") ||
    lower.includes("approve") ||
    lower.includes("อนุมัติ")
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

  // 2. Buyer query
  if (
    lower.includes("buyer") ||
    lower.includes("ลูกหนี้") ||
    lower.includes("ลูกค้า") ||
    lower.includes("จ่ายเงิน") ||
    lower.includes("overdue") ||
    lower.includes("ค้างชำระ") ||
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

  // 3. Order feasibility check
  if (
    lower.includes("order") ||
    lower.includes("คำสั่งซื้อ") ||
    lower.includes("รับออเดอร์") ||
    lower.includes("กำไร") ||
    lower.includes("margin") ||
    lower.includes("feasibility") ||
    pageContext === "new-order"
  ) {
    return { needsTool: true, toolName: "check_order", args: {} };
  }

  // 4. Procurement & Material price
  if (
    lower.includes("procurement") ||
    lower.includes("วัตถุดิบ") ||
    lower.includes("ราคาเหล็ก") ||
    lower.includes("ราคาตลาด") ||
    lower.includes("material") ||
    lower.includes("steel") ||
    lower.includes("aluminium") ||
    lower.includes("resin") ||
    pageContext === "procurement"
  ) {
    let material = "Cold-rolled steel";
    if (lower.includes("aluminium") || lower.includes("อลูมิเนียม")) material = "Aluminium coil";
    else if (lower.includes("resin") || lower.includes("เรซิน")) material = "ABS resin";

    return { needsTool: true, toolName: "get_procurement", args: { material } };
  }

  // Fallback: If on specific pages, contextually trigger corresponding tool
  if (pageContext === "receivables") {
    return { needsTool: true, toolName: "get_buyer", args: { buyerName: "Shenzhen ElectroParts" } };
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

    // 2. Client/Server-side Data Masking for privacy
    const masking = createMaskingAdapter();
    const maskedMessage = masking.mask("contact", message, "User Query");

    // 3. Formulate System Prompt with Page Context & Persona
    const pagePersona: Record<string, string> = {
      home: "You are BizMateAI Lead Copilot on the Main Executive Dashboard.",
      data: "You are BizMateAI Data Integrator on the Multi-bank & Statement Screen.",
      "new-order": "You are BizMateAI Order Feasibility Evaluator on the New Order Screen.",
      receivables: "You are BizMateAI Receivables & Collections Specialist on the Receivables Screen.",
      procurement: "You are BizMateAI Procurement & Price Hedging Specialist on the Procurement Screen.",
      financing: "You are BizMateAI Financing & Credit Specialist on the Working Capital Screen.",
      trust: "You are BizMateAI Trust & Deterministic Audit Officer on the Audit Screen.",
      generator: "You are BizMateAI Mock Document Generator Specialist.",
    };

    const persona = pagePersona[pageContext] || pagePersona.home;

    const extraPrompt = `${persona}
Target market: SME / SMEs manufacturers.
Current page context: /dashboard/${pageContext}.
Cash in hand: ${COMPANY.currency}${VITALS.cashNow.toLocaleString()}, Health Score: ${HEALTH.score}/100 (${HEALTH.mood}).

${
  toolResult
    ? `System Tool [${toolResult.toolName}] executed successfully. Tool Fact Data:
${toolResult.summary}
Raw data: ${JSON.stringify(toolResult.data)}`
    : `No tool required. Answer directly, concisely, and helpfully based on BizMateAI capabilities.`
}

Instruction:
1. Provide a direct, polite, highly practical response (Thai or English matching the user's language).
2. Keep the answer concise (2-4 sentences).
3. If tool data was retrieved, synthesize it clearly and reference the next action.`;

    const systemPrompt = buildSystemPrompt(extraPrompt);

    // 4. LLM Call
    let replyText = "";
    try {
      const response = await callModel({
        task: "ask_bizmate_chat",
        systemPrompt,
        userPrompt: maskedMessage || message,
      });
      replyText = masking.unmask(response.text || "");
    } catch (err: any) {
      console.warn("LLM call failed or unavailable, fallback to deterministic reply:", err);
      if (toolResult) {
        replyText = `${toolResult.summary}\n\nYou can click the button below to take immediate action on this item.`;
      } else {
        replyText = `BizMateAI Copilot is active on this page. How can I assist you with your cash flow, debtor habits, or procurement plans today?`;
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
