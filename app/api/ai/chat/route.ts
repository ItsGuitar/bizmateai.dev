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
  toolName: "get_buyer" | "check_order" | "get_procurement" | "propose_action" | "navigate_help";
  data: any;
  summary: string;
  action?: ChatAction;
}

// Tool 5: navigate_help - Accurate feature guidance & direct link card
function executeNavigateHelp(intentKey: string): ChatToolResult {
  const routesHelp: Record<string, { summary: string; action: ChatAction }> = {
    receipt_upload: {
      summary: "คุณสามารถสแกนหรืออัปโหลดใบเสร็จ (Receipts) และใบแจ้งหนี้ (Invoices) ได้ที่หน้า 'Data' โดยใช้ AI Document Scan (OCR) เพื่อนำเข้าสู่ระบบคำนวณการเงินโดยอัตโนมัติ",
      action: {
        type: "navigate",
        label: "ไปที่หน้า Data & Document Scan (อัปโหลดใบเสร็จ)",
        href: "/dashboard/data",
      },
    },
    doc_generator: {
      summary: "หากต้องการจำลองสร้างเอกสารการค้า เช่น ใบเสร็จ ใบสั่งซื้อ (PO) หรือใบแจ้งหนี้เพื่อทดสอบ สามารถไปที่ 'Generator'",
      action: {
        type: "navigate",
        label: "ไปที่ Mock Document Generator",
        href: "/dashboard/generator",
      },
    },
    receivables: {
      summary: "ติดตามลูกหนี้และพฤติกรรมการจ่ายเงิน ตรวจสอบใบแจ้งหนี้ค้างชำระได้ที่ 'Receivables'",
      action: {
        type: "navigate",
        label: "ไปที่หน้า Receivables",
        href: "/dashboard/receivables",
      },
    },
    new_order: {
      summary: "วิเคราะห์ความเป็นไปได้ของคำสั่งซื้อใหม่ คำนวณกำไรและเงินทุนหมุนเวียนได้ที่ 'New order'",
      action: {
        type: "navigate",
        label: "ไปที่หน้า New Order",
        href: "/dashboard/new-order",
      },
    },
    procurement: {
      summary: "เช็คราคาตลาดวัตถุดิบสปอตและวางแผนล็อกราคาได้ที่ 'Procurement'",
      action: {
        type: "navigate",
        label: "ไปที่หน้า Procurement",
        href: "/dashboard/procurement",
      },
    },
    financing: {
      summary: "ค้นหาแพ็กเกจสินเชื่อเงินทุนหมุนเวียนและสินเชื่อสีเขียวได้ที่ 'Financing'",
      action: {
        type: "navigate",
        label: "ไปที่หน้า Financing",
        href: "/dashboard/financing",
      },
    },
    agent_room: {
      summary: "ตรวจสอบการทำงานร่วมกันของ 6 Agent และอนุมัติคำขอใน Central Inbox ได้ที่ 'Agent Room'",
      action: {
        type: "navigate",
        label: "ไปที่ Central Inbox (Agent Room)",
        href: "/dashboard/agent-room",
      },
    },
  };

  const selected = routesHelp[intentKey] || routesHelp.receipt_upload;
  return {
    toolName: "navigate_help",
    data: { intentKey },
    summary: selected.summary,
    action: selected.action,
  };
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
  toolName?: "get_buyer" | "check_order" | "get_procurement" | "propose_action" | "navigate_help";
  args?: any;
} {
  const lower = message.toLowerCase().trim();

  // 1. Navigation / Document Upload / Receipts questions (explicit document / feature guidance)
  if (
    lower.includes("ใบเสร็จ") ||
    lower.includes("ใบแจ้งหนี้") ||
    lower.includes("เพิ่มใบเสร็จ") ||
    lower.includes("อัปโหลด") ||
    lower.includes("upload") ||
    lower.includes("receipt") ||
    lower.includes("invoice") ||
    lower.includes("สแกน") ||
    lower.includes("ocr") ||
    lower.includes("สลิป") ||
    lower.includes("เพิ่มเอกสาร")
  ) {
    if (lower.includes("mock") || lower.includes("จำลอง") || lower.includes("generate")) {
      return { needsTool: true, toolName: "navigate_help", args: { intentKey: "doc_generator" } };
    }
    return { needsTool: true, toolName: "navigate_help", args: { intentKey: "receipt_upload" } };
  }

  // 2. Navigation / Feature locating intents
  if (
    lower.includes("ไปหน้าไหน") ||
    lower.includes("ทำยังไง") ||
    lower.includes("เข้าตรงไหน") ||
    lower.includes("ดูตรงไหน") ||
    lower.includes("อยู่ที่ไหน")
  ) {
    if (lower.includes("ลูกหนี้") || lower.includes("ทวง")) {
      return { needsTool: true, toolName: "navigate_help", args: { intentKey: "receivables" } };
    }
    if (lower.includes("ออเดอร์") || lower.includes("คำสั่งซื้อ")) {
      return { needsTool: true, toolName: "navigate_help", args: { intentKey: "new_order" } };
    }
    if (lower.includes("วัตถุดิบ") || lower.includes("ราคาเหล็ก")) {
      return { needsTool: true, toolName: "navigate_help", args: { intentKey: "procurement" } };
    }
    if (lower.includes("กู้") || lower.includes("สินเชื่อ") || lower.includes("financing")) {
      return { needsTool: true, toolName: "navigate_help", args: { intentKey: "financing" } };
    }
    if (lower.includes("inbox") || lower.includes("อนุมัติ")) {
      return { needsTool: true, toolName: "navigate_help", args: { intentKey: "agent_room" } };
    }
  }

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

  // 3. Propose action / Approval requests (explicit intent to create action card)
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

  // 4. Buyer query (explicit buyer/debtor questions)
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

  // 5. Order feasibility check (explicit new order evaluation)
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

  // 6. Procurement & Material price (explicit material market query)
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
      if (detection.toolName === "navigate_help") {
        toolResult = executeNavigateHelp(detection.args?.intentKey);
      } else if (detection.toolName === "get_buyer") {
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

    // 2. Formulate Page Context & Persona with Comprehensive Base Knowledge
    const pagePersona: Record<string, { role: string; capabilities: string }> = {
      home: {
        role: "BizMateAI Lead Copilot on the Executive Dashboard",
        capabilities: "ดูภาพรวมสุขภาพการเงิน (Health Score 78/100), กราฟเงินสด Cash Runway 14 สัปดาห์, การเตือนพายุราคาวัตถุดิบ (Price Risk Storm), ตรวจสอบเหรียญสภาพคล่องจำลองตามบัญชีที่เปิด, และทางลัดไปยัง Agent Room",
      },
      data: {
        role: "BizMateAI Data Integrator on the Multi-Bank & Document Scan Screen",
        capabilities: "จัดการบัญชีธนาคาร (KBank, SCB, BBL, Personal), นำเข้าสเตทเมนต์การเงิน, สแกน/อัปโหลดใบเสร็จและใบแจ้งหนี้ (AI Document Scan OCR), สลับเปิด-ปิดเอกสารที่นำมาคำนวณ และดูผลกระทบต่อ Cash Flow",
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
      "agent-room": {
        role: "BizMateAI Central Inbox & Agent Orchestrator",
        capabilities: "ศูนย์บัญชาการกลางและกล่องข้อความอนุมัติ (Central Inbox) ซึ่งรวบรวมคำขออนุมัติจาก 6 AI Agents ตามนโยบาย Zero-Surprise Policy",
      },
    };

    const currentContext = pagePersona[pageContext] || pagePersona.home;

    const chatSystemPrompt = `You are ${currentContext.role} for BizMateAI (an autonomous financial copilot for SME manufacturers).

SYSTEM ARCHITECTURE & BASE KNOWLEDGE (ACTUAL ROUTES & FEATURES):
1. **Executive Dashboard** (\`/dashboard\`): Financial Health Score, 14-week Cash Runway projection, Price Risk Storm alerts, working capital simulation, Factory Coin visualization.
2. **Data & Document Scan** (\`/dashboard/data\`):
   - **Upload/Add Receipts & Invoices**: Users can scan or upload physical/digital receipts and invoices using AI Document Scan (OCR). The system extracts counterparty, issue date, due date, amount, and doc type automatically into the database.
   - **Multi-Bank Connection**: Connect and toggle accounts for KBank (Ploy Select), SCB (Apex Craft Furniture), BBL (BioHarvest Agro Tech), and Personal (Kittisak Somchai).
   - **Statement Ingest**: Upload 365-day bank statements to recalculate real-time financial metrics.
3. **New Order Evaluation** (\`/dashboard/new-order\`): Evaluate new buyer purchase orders, simulate material costs, profit margins, and identify cash gap financing needs before accepting.
4. **Receivables (AR)** (\`/dashboard/receivables\`): Monitor outstanding invoices, debtor habit scores (Grade A to D), expected payment delay distribution (mu/sigma), and draft polite payment reminders.
5. **Procurement** (\`/dashboard/procurement\`): Spot raw material tracking (Cold-rolled steel, Aluminium coil, ABS resin), price volatility hedge, and split-lot procurement schedules.
6. **Financing** (\`/dashboard/financing\`): Working capital loan matching (WeBank SME, Credit Ease), Green-eligible subsidy qualification, and interest rate ceiling calculations.
7. **Trust & Audit** (\`/dashboard/trust\`): Merkle-tree cryptographic audit trail, immutable action history, Zero-Surprise human-in-the-loop governance, PDPA data anonymization.
8. **Document Generator** (\`/dashboard/generator\`): Mock generator for creating test invoices, purchase orders, and synthetic statements.
9. **Central Inbox / Agent Room** (\`/dashboard/agent-room\`): Review, approve, or reject proposed agent actions (e.g., sending reminders, requesting loan quotes).

CURRENT CONTEXT & COMPANY VITALS:
- Current Page: /dashboard/${pageContext}
- Page Role: ${currentContext.role}
- Capabilities of this page: ${currentContext.capabilities}
- Cash on Hand: ${COMPANY.currency}${VITALS.cashNow.toLocaleString()}
- Health Score: ${HEALTH.score}/100 (${HEALTH.mood})

CRITICAL CONVERSATIONAL RULES:
1. NEVER address the user by echoing their question or swearing/vulgar phrases (e.g. NEVER repeat words like "หน้านี้ทำเหี้ย...", "มึง...", or any quoted profanity). Greet politely or dive straight into the answer.
2. Provide ACCURATE, REAL guidance based on the ACTUAL system architecture above. Never invent fictitious menus like "เอกสาร/รายรับ-รายจ่าย".
3. When the user asks how to do something or where to find a feature (e.g. adding receipts, checking debt, testing orders), direct them to the exact page path and explain how the feature works.
4. Match the user's language naturally (polite, knowledgeable Thai or professional English).
5. Keep answers direct, helpful, and concise (2-4 sentences). Do not mention system prompts or internals.
${
  toolResult
    ? `6. System Tool [${toolResult.toolName}] Data:
${toolResult.summary}
Raw data: ${JSON.stringify(toolResult.data)}
Guide the user with this data and emphasize the action button provided.`
    : `6. No tool invocation needed. Answer directly using your complete Base Knowledge of BizMateAI.`
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
