// Real feature (not a /dev/ test route): the generator page's "Send to the AI agent" button hits
// this. Masks the one real identity in an otherwise synthetic document (the home company name),
// sends the rendered document image to a vision-capable model under the core guardrails, and
// returns the extracted fields next to nothing else. If the live call fails for any reason, it
// falls back to a result built straight from the document's own known ground truth, clearly
// flagged `simulated: true` so the UI never confuses it with a real model response.

import { NextResponse } from "next/server";
import { createMaskingAdapter } from "@/lib/ai/masking";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { callModel } from "@/lib/ai/client";
import { recordAiCall } from "@/lib/ai/call-log";
import type { Archetype, GroundTruthFields } from "@/lib/document-generator";

const TASK = "document_reading" as const;

export interface ExtractDocumentRequest {
  imageBase64: string; // raw base64, no "data:image/png;base64," prefix
  mimeType: string;
  archetype: Archetype;
  homeCompanyName: string;
  groundTruth: GroundTruthFields;
}

export interface ExtractedFields {
  documentNumber?: string;
  issueDate?: string;
  buyerName?: string;
  sellerName?: string;
  grandTotal?: number;
  currencySymbol?: string;
  lineItemCount?: number;
}

export interface ExtractDocumentResponse {
  ok: boolean;
  simulated: boolean;
  fallbackReason?: string;
  extractedFields: ExtractedFields;
  rawModelText?: string;
}

const EXTRACTION_INSTRUCTION =
  "This image is a commercial document (purchase order, invoice, receipt, or a raw spreadsheet export). Read it and reply with ONLY compact JSON, no prose, no markdown fences, matching this shape: " +
  '{"documentNumber": string, "issueDate": string, "buyerName": string, "sellerName": string, "grandTotal": number, "currencySymbol": string, "lineItemCount": number}. ' +
  "If a field is redacted or unreadable, omit it rather than guessing.";

function parseExtractedFields(rawText: string): ExtractedFields {
  const cleaned = rawText.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    documentNumber: typeof parsed.documentNumber === "string" ? parsed.documentNumber : undefined,
    issueDate: typeof parsed.issueDate === "string" ? parsed.issueDate : undefined,
    buyerName: typeof parsed.buyerName === "string" ? parsed.buyerName : undefined,
    sellerName: typeof parsed.sellerName === "string" ? parsed.sellerName : undefined,
    grandTotal: typeof parsed.grandTotal === "number" ? parsed.grandTotal : undefined,
    currencySymbol: typeof parsed.currencySymbol === "string" ? parsed.currencySymbol : undefined,
    lineItemCount: typeof parsed.lineItemCount === "number" ? parsed.lineItemCount : undefined,
  };
}

function groundTruthToExtractedFields(groundTruth: GroundTruthFields): ExtractedFields {
  return {
    documentNumber: groundTruth.documentNumber,
    issueDate: groundTruth.issueDate,
    buyerName: groundTruth.buyerName,
    sellerName: groundTruth.sellerName,
    grandTotal: groundTruth.grandTotal,
    currencySymbol: groundTruth.currencySymbol,
    lineItemCount: groundTruth.lineItemCount,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as ExtractDocumentRequest;
  const { imageBase64, mimeType, homeCompanyName, groundTruth } = body;

  const adapter = createMaskingAdapter();
  adapter.mask("company", homeCompanyName, "Company");

  const systemPrompt = buildSystemPrompt(EXTRACTION_INSTRUCTION);

  try {
    const result = await callModel({
      task: TASK,
      systemPrompt,
      userPrompt: "Extract the fields from the attached document image.",
      imagePart: { mimeType, base64Data: imageBase64 },
    });

    const extractedFields = parseExtractedFields(result.text);

    const response: ExtractDocumentResponse = {
      ok: true,
      simulated: false,
      extractedFields,
      rawModelText: result.text,
    };
    return NextResponse.json(response);
  } catch (err) {
    const response: ExtractDocumentResponse = {
      ok: true,
      simulated: true,
      fallbackReason: err instanceof Error ? err.message : "The AI agent is unavailable right now.",
      extractedFields: groundTruthToExtractedFields(groundTruth),
    };
    return NextResponse.json(response);
  }
}
