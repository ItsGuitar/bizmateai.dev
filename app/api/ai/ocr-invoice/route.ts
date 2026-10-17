import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { recordAiCall } from "@/lib/ai/call-log";
import { createMaskingAdapter } from "@/lib/ai/masking";

const TASK = "document_reading" as const;

export interface InvoiceOcrItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface InvoiceOcrFields {
  documentType?: "invoice" | "purchase_order" | "receipt" | "other";
  counterpartyName?: string;
  documentNumber?: string;
  issueDate?: string;
  dueDate?: string;
  termsDays?: number;
  totalAmount?: number;
  currency?: string;
  items?: InvoiceOcrItem[];
}

export interface InvoiceOcrConfidence {
  documentType: number;
  counterpartyName: number;
  documentNumber: number;
  issueDate: number;
  dueDate: number;
  termsDays: number;
  totalAmount: number;
  currency: number;
  items: number;
  overall: number;
}

export interface InvoiceOcrResponse {
  ok: boolean;
  fields: InvoiceOcrFields;
  confidence: InvoiceOcrConfidence;
  rawText?: string;
  simulated?: boolean;
  error?: string;
}

const OCR_SYSTEM_INSTRUCTION = `You are a specialized multimodal vision agent for BizMateAI Supplier Copilot.
You inspect commercial document photos (invoices, purchase orders, receipts) to extract billing and order details.
Notice: The user may have drawn black redaction boxes directly over sensitive identification or bank account numbers before uploading. Respect redacted areas and omit or note them rather than hallucinating.

CRITICAL TASK - AUTOMATIC CLASSIFICATION:
You must automatically classify the documentType by carefully analyzing the document title, headers, and terminology:
- "purchase_order": Documents titled "Purchase Order", "PO", "Order Form", "ใบสั่งซื้อ", "采购订单", or showing buyer placing an order to supplier.
- "invoice": Documents titled "Invoice", "Tax Invoice", "Commercial Invoice", "ใบกำกับภาษี", "ใบแจ้งหนี้", "发票", or demanding payment for fulfilled goods.
- "receipt": Documents titled "Receipt", "Official Receipt", "ใบเสร็จรับเงิน", "收据".
- "other": Contracts, quotes, or shipping lists.

Your output must be strict, valid JSON matching this exact structure:
{
  "fields": {
    "documentType": "invoice" | "purchase_order" | "receipt" | "other",
    "counterpartyName": "string or empty",
    "documentNumber": "string or empty",
    "issueDate": "YYYY-MM-DD or empty",
    "dueDate": "YYYY-MM-DD or empty",
    "termsDays": number or null,
    "totalAmount": number or null,
    "currency": "¥" | "฿" | "$" | "CNY" | "THB" | "USD" | "EUR" or empty,
    "items": [
      {
        "description": "string",
        "quantity": number,
        "unitPrice": number,
        "totalPrice": number
      }
    ]
  },
  "confidence": {
    "documentType": number (0.0 to 1.0),
    "counterpartyName": number (0.0 to 1.0),
    "documentNumber": number (0.0 to 1.0),
    "issueDate": number (0.0 to 1.0),
    "dueDate": number (0.0 to 1.0),
    "termsDays": number (0.0 to 1.0),
    "totalAmount": number (0.0 to 1.0),
    "currency": number (0.0 to 1.0),
    "items": number (0.0 to 1.0),
    "overall": number (0.0 to 1.0)
  }
}

Important:
- Return ONLY valid raw JSON. Do not wrap in markdown quotes or \`\`\`json fences.
- If termsDays is not explicitly written, compute days between issueDate and dueDate if both exist.
- Each confidence score should realistically reflect visual legibility, clarity, and certainty from 0.0 to 1.0.`;

function fallbackExtraction(fileName?: string): { fields: InvoiceOcrFields; confidence: InvoiceOcrConfidence } {
  const isPO = fileName?.toLowerCase().includes("po") || fileName?.toLowerCase().includes("order");
  return {
    fields: {
      documentType: isPO ? "purchase_order" : "invoice",
      counterpartyName: "Guangzhou Motors Co., Ltd.",
      documentNumber: isPO ? "PO-2026-8891" : "INV-2026-1042",
      issueDate: "2026-10-17",
      dueDate: "2026-12-01",
      termsDays: 45,
      totalAmount: 2990000,
      currency: "¥",
      items: [
        {
          description: "Precision Stamped Automotive Chassis Components (Grade A Cold-Rolled)",
          quantity: 260000,
          unitPrice: 11.5,
          totalPrice: 2990000,
        },
      ],
    },
    confidence: {
      documentType: 0.95,
      counterpartyName: 0.92,
      documentNumber: 0.96,
      issueDate: 0.95,
      dueDate: 0.9,
      termsDays: 0.88,
      totalAmount: 0.97,
      currency: 0.98,
      items: 0.92,
      overall: 0.94,
    },
  };
}

let lastOcrCallTimestamp = 0;
const OCR_COOLDOWN_MS = 60000; // 1 minute cooldown

export async function POST(request: Request) {
  try {
    const now = Date.now();
    const timeSinceLastCall = now - lastOcrCallTimestamp;

    if (timeSinceLastCall < OCR_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((OCR_COOLDOWN_MS - timeSinceLastCall) / 1000);
      return NextResponse.json(
        {
          ok: false,
          error: `Rate limit: Please wait ${remainingSeconds} seconds before scanning another document.`,
          remainingSeconds,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { imageBase64, mimeType = "image/png", fileName = "document.png" } = body;

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "Image data is required" }, { status: 400 });
    }

    // Set timestamp after passing validation
    lastOcrCallTimestamp = now;

    const adapter = createMaskingAdapter();
    const systemPrompt = buildSystemPrompt(OCR_SYSTEM_INSTRUCTION);

    const startTime = Date.now();

    try {
      const result = await callModel({
        task: TASK,
        systemPrompt,
        userPrompt: "Extract the structured invoice/purchase order fields and assign confidence ratings based on visual document legibility.",
        imagePart: {
          mimeType,
          base64Data: imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, ""),
        },
      });

      const cleaned = result.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);

      return NextResponse.json({
        ok: true,
        fields: parsed.fields || {},
        confidence: parsed.confidence || { overall: 0.85 },
        simulated: false,
      });
    } catch (aiErr: unknown) {
      console.warn("Live Gemini OCR call failed or timed out, returning structured fallback:", aiErr);
      const errMessage = aiErr instanceof Error ? aiErr.message : String(aiErr);

      recordAiCall({
        task: "ocr_invoice",
        at: new Date().toISOString(),
        systemPrompt,
        maskedPrompt: OCR_SYSTEM_INSTRUCTION,
        mapping: adapter.mapping,
        maskedReply: "FALLBACK_TRIGGERED",
        unmaskedReply: "FALLBACK_TRIGGERED",
        model: "gemini-3.5-flash-lite",
        temperature: 0.1,
        status: "fallback",
        errorMessage: errMessage,
        latencyMs: Date.now() - startTime,
      });

      const fallback = fallbackExtraction(fileName);
      return NextResponse.json({
        ok: true,
        fields: fallback.fields,
        confidence: fallback.confidence,
        simulated: true,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error processing document OCR";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
