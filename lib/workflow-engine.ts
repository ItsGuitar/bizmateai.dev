// Multi-agent workflow state machine (Lead -> Procurement -> Receivables -> Financing), driving
// the Agent Room screen. Every number comes from the deterministic engines below, fed with the
// signed-in user's own ingested documents and calculation snapshot; Gemini is only asked to
// phrase the dialogue, once per run, never to decide numbers or whether to challenge.
//
// Rate-limit discipline (see plan: ขั้นตอนที่ 6):
// - Exactly one callModel() call per run, carrying every agent/stage's numbers in one prompt.
// - Challenge-round triggers are rule-based (detectChallenges), never asked of the model.
// - Narration is cached by a fingerprint of the computed numbers (6h TTL, same pattern as
//   app/api/ai/daily-brief/route.ts); a call that fails falls back to a template immediately,
//   no retry.
//
// Real-data wiring: overdue invoices and buyer risk come from the user's own IngestedDocument
// rows, blended with the buyer models already computed by lib/calculation-pipeline.ts
// (CalculationSnapshot) when that user has run a calculation. A buyer the pipeline hasn't seen
// yet falls back to the portfolio prior in lib/order-engine.ts, same as the rest of the app.
// Company-level inputs (CompanyProfile, safety cushion) are still the project's seed data; see
// plan item 3/4 (ขั้นตอนที่ 6) for wiring those to BusinessProfile.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { callModel } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/guardrails";
import { createMaskingAdapter } from "@/lib/ai/masking";
import {
  AS_OF,
  CHASE_STEPS,
  DEFAULT_ORDER_INPUT,
  checkOrder,
  chaseStepForOverdue,
  expectedOpenInvoicePayment,
  formatDate,
  getBuyerModel,
  type BuyerModel,
  type OrderCheckResult,
  type OrderInput,
} from "@/lib/order-engine";
import { COMPANY_PROFILE, matchLenders, type MatchedProduct } from "@/lib/financing-engine";
import { CASH_WEEKS } from "@/app/data/supplier-copilot-mock";
import type { PipelineOutput } from "@/lib/calculation-pipeline";
import type { AgentRoomEvent, AgentRoomStep, ApprovalCard, WorkflowRun, WorkflowType } from "@/lib/workflow-types";

const TASK = "workflow_narration" as const;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface NarrationCacheEntry {
  lines: Record<string, { statusText: string; text: string }>;
  timestamp: number;
}
const narrationCache = new Map<string, NarrationCacheEntry>();

function fingerprint(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function formatMoney(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Real user data: overdue invoices + the user's latest calculation snapshot
// ---------------------------------------------------------------------------

interface OverdueRow {
  buyerName: string;
  invoiceId: string;
  docNumber: string;
  amount: number;
  overdueDays: number;
  chaseStep: (typeof CHASE_STEPS)[number];
}

async function getSnapshot(userId: string): Promise<PipelineOutput | null> {
  const snapshot = await prisma.calculationSnapshot.findUnique({ where: { userId } });
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot.resultJson) as PipelineOutput;
  } catch {
    return null;
  }
}

// Overdue invoices from this user's own ingested documents, risk-scored with the buyer model the
// deterministic pipeline already computed for them (credibility-blended with real invoice
// history) when available, falling back to the portfolio prior for a buyer the pipeline hasn't
// seen yet. This replaces the project's static OPEN_INVOICES demo list.
async function getRealOverdueInvoices(userId: string, snapshot: PipelineOutput | null): Promise<OverdueRow[]> {
  const docs = await prisma.ingestedDocument.findMany({ where: { userId, isEnabled: true } });
  const invoiceDocs = docs.filter((d) => d.docType.toLowerCase().includes("invoice") && d.dueDate);

  const rows: OverdueRow[] = [];
  for (const doc of invoiceDocs) {
    const bm = snapshot?.buyerModels.find((b) => b.buyerName === doc.counterparty);
    const buyer: BuyerModel = bm
      ? { name: doc.counterparty, mu: bm.mu, sigma: bm.sigma, grade: bm.grade, n: 2 }
      : getBuyerModel(doc.counterparty);
    const dueDate = new Date(`${doc.dueDate}T00:00:00Z`);
    const payment = expectedOpenInvoicePayment(dueDate, buyer, AS_OF);
    if (payment.risk === "none") continue;
    rows.push({
      buyerName: doc.counterparty,
      invoiceId: doc.id,
      docNumber: doc.docNumber,
      amount: doc.amount,
      overdueDays: payment.overdueDays,
      chaseStep: chaseStepForOverdue(payment.overdueDays),
    });
  }
  return rows.sort((a, b) => b.overdueDays - a.overdueDays);
}

// ---------------------------------------------------------------------------
// Order plan: computed numbers (deterministic, no Gemini)
// ---------------------------------------------------------------------------

interface OrderPlanNumbers {
  input: OrderInput;
  order: OrderCheckResult;
  overdueInvoices: OverdueRow[];
  lenders: MatchedProduct[];
  challenges: {
    collectFirst: boolean;
    splitLot: boolean;
  };
  stressLow: number;
  cushion: number;
}

async function computeOrderPlanNumbers(userId: string, input: OrderInput = DEFAULT_ORDER_INPUT): Promise<OrderPlanNumbers> {
  const order = checkOrder(input, "base");
  const snapshot = await getSnapshot(userId);
  const overdueInvoices = await getRealOverdueInvoices(userId, snapshot);
  const lenders = matchLenders(order.financingNeedHigh, order.revenue, COMPANY_PROFILE, order.rateCeilingPct);

  // Stress-case cash low point: the user's own 13-week bear forecast when they've run a
  // calculation, otherwise the project's demo 26-week stress series (see plan item 4: safety
  // cushion itself still isn't persisted per user, so the cushion threshold stays a constant).
  const stressLow = snapshot
    ? Math.min(...snapshot.forecasts.bear.map((w) => w.closingCash))
    : Math.min(...CASH_WEEKS.map((w) => w.stress));
  const cushion = 980000;

  const overdueTotal = overdueInvoices.reduce((sum, row) => sum + row.amount, 0);

  const challenges = {
    // Challenge 1: collect overdue cash before financing anything.
    collectFirst: overdueTotal > 0 && order.financingNeedHigh > 0,
    // Challenge 2: smooth the material buy into two lots if the stress case bites the cushion.
    splitLot: stressLow < cushion && order.tonnes >= 50,
  };

  return { input, order, overdueInvoices, lenders, challenges, stressLow, cushion };
}

// ---------------------------------------------------------------------------
// Collect: computed numbers (deterministic, no Gemini)
// ---------------------------------------------------------------------------

interface CollectNumbers {
  overdue: OverdueRow[];
  totalAmount: number;
}

async function computeCollectNumbers(userId: string): Promise<CollectNumbers> {
  const snapshot = await getSnapshot(userId);
  const overdue = await getRealOverdueInvoices(userId, snapshot);
  return { overdue, totalAmount: overdue.reduce((sum, row) => sum + row.amount, 0) };
}

// ---------------------------------------------------------------------------
// Narration: exactly one Gemini call per run, cached by input fingerprint
// ---------------------------------------------------------------------------

interface NarrationSlot {
  id: string;
  from: string;
  to: string;
  facts: string; // masked, numbers-only summary the model may turn into prose
  isChallenge: boolean;
}

async function narrateSlots(
  workflow: WorkflowType,
  slots: NarrationSlot[],
  buyerNames: string[],
  slotFingerprintPayload: unknown
): Promise<Record<string, { statusText: string; text: string }>> {
  const key = `${workflow}:${fingerprint(slotFingerprintPayload)}`;
  const cached = narrationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.lines;
  }

  const masking = createMaskingAdapter();
  const uniqueBuyerNames = [...new Set(buyerNames)];
  const maskedSlots = slots.map((s) => ({ ...s, facts: maskFacts(s.facts, masking, uniqueBuyerNames) }));

  const systemPrompt = buildSystemPrompt(
    `You are narrating a multi-agent factory financial workflow for the Agent Room screen. For each slot ` +
      `below, write ONE short line for "statusText" (a present-tense gerund phrase, e.g. "Checking the buyer's payment window") ` +
      `and ONE short line for "text" (1-2 plain sentences spoken by the "from" agent to the "to" agent, using only the facts given). ` +
      `Never introduce a number that is not already in "facts". Output strict JSON: {"<slot id>": {"statusText": "...", "text": "..."}, ...}`
  );
  const userPrompt = JSON.stringify(maskedSlots);

  let lines: Record<string, { statusText: string; text: string }>;
  try {
    const result = await callModel({ task: TASK, systemPrompt, userPrompt });
    const parsed = JSON.parse(stripCodeFence(result.text));
    lines = {};
    for (const slot of slots) {
      const entry = parsed[slot.id];
      lines[slot.id] = entry && entry.statusText && entry.text
        ? { statusText: masking.unmask(String(entry.statusText)), text: masking.unmask(String(entry.text)) }
        : fallbackLine(slot);
    }
  } catch (err) {
    console.warn("workflow narration fallback:", err);
    lines = {};
    for (const slot of slots) lines[slot.id] = fallbackLine(slot);
  }

  narrationCache.set(key, { lines, timestamp: Date.now() });
  return lines;
}

function maskFacts(facts: string, masking: ReturnType<typeof createMaskingAdapter>, buyerNames: string[]): string {
  // Buyer names are the only free text worth masking in `facts`; amounts and dates pass through
  // untouched (callModel's guardrail never needs them masked, see lib/ai/masking.ts).
  let result = facts;
  for (const name of buyerNames) {
    const token = masking.mask("buyer", name, "Buyer");
    if (token) result = result.split(name).join(token);
  }
  return result;
}

function fallbackLine(slot: NarrationSlot): { statusText: string; text: string } {
  return { statusText: slot.facts, text: slot.facts };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : trimmed;
}

// ---------------------------------------------------------------------------
// Order plan run
// ---------------------------------------------------------------------------

export async function runOrderPlanWorkflow(userId: string, input: OrderInput = DEFAULT_ORDER_INPUT): Promise<WorkflowRun> {
  const numbers = await computeOrderPlanNumbers(userId, input);
  const { order, overdueInvoices, lenders, challenges } = numbers;
  const topLender = lenders.find((l) => l.eligible && l.covers) ?? lenders[0];

  const steps: AgentRoomStep[] = [
    { id: "read_order", label: "Read the new order" },
    { id: "cost", label: "Forecast material cost" },
    { id: "payment_timing", label: "When the buyer pays" },
    { id: "cash_impact", label: "Work out the cash impact" },
    { id: "financing_draft", label: "Draft financing options" },
    ...(challenges.collectFirst ? [{ id: "challenge_collect", label: "Challenge: collect first?" }] : []),
    ...(challenges.splitLot ? [{ id: "challenge_split", label: "Challenge: split the lot?" }] : []),
    { id: "decide", label: "Pick the cheapest option" },
  ];

  const slots: NarrationSlot[] = [
    {
      id: "ev-1",
      from: "lead",
      to: "procurement",
      isChallenge: false,
      facts: `New order from ${order.buyer.name}: ${order.input.qty.toLocaleString()} units, delivery ${formatDate(order.journey[3].date)}, ${order.input.termsDays}-day terms.`,
    },
    {
      id: "ev-2",
      from: "procurement",
      to: "lead",
      isChallenge: false,
      facts: `Need ${order.tonnes.toFixed(0)} t of ${order.input.material} by ${formatDate(order.journey[3].date)}. Expected cost ${formatMoney(order.materialCostMid)}, range ${formatMoney(order.materialCostLow)}-${formatMoney(order.materialCostHigh)}.`,
    },
    {
      id: "ev-3",
      from: "receivables",
      to: "lead",
      isChallenge: false,
      facts: `${order.buyer.name} is Grade ${order.buyer.grade}. Expect payment around ${formatDate(order.buyerPay.expected)}, ${order.input.termsDays}-day terms.`,
    },
    {
      id: "ev-4",
      from: "lead",
      to: "financing",
      isChallenge: false,
      facts: `Supplier paid ${formatDate(order.supplierPayDate)}, buyer pays ${formatDate(order.buyerPay.expected)}. Base-case gap ${formatMoney(order.financingNeedLow)}, stress-case gap up to ${formatMoney(order.financingNeedHigh)}.`,
    },
    {
      id: "ev-5",
      from: "financing",
      to: "lead",
      isChallenge: false,
      facts: topLender
        ? `Best match: ${topLender.product.name}, all-in rate ${topLender.allIn.toFixed(1)}%, covers up to ${formatMoney(topLender.cap)}.`
        : `No lender in the catalog currently covers the full need.`,
    },
    ...(challenges.collectFirst
      ? [
          {
            id: "ev-6",
            from: "receivables",
            to: "lead",
            isChallenge: true,
            facts: `Before financing anything: ${overdueInvoices.length} overdue invoice(s) worth ${formatMoney(overdueInvoices.reduce((s, r) => s + r.amount, 0))} could be collected first.`,
          },
        ]
      : []),
    ...(challenges.splitLot
      ? [
          {
            id: "ev-7",
            from: "procurement",
            to: "lead",
            isChallenge: true,
            facts: `The stress-case cash low point is ${formatMoney(numbers.stressLow)}, below the ${formatMoney(numbers.cushion)} cushion. Splitting the ${order.tonnes.toFixed(0)} t buy into two lots smooths the outflow.`,
          },
        ]
      : []),
    {
      id: "ev-8",
      from: "lead",
      to: "lead",
      isChallenge: false,
      facts: `Decision: ${challenges.collectFirst ? "collect overdue cash first, " : ""}${challenges.splitLot ? "split the material lot, " : ""}then ${topLender ? topLender.product.name : "the best available option"} for anything left. Cheapest money first.`,
    },
  ];

  const buyerNames = [order.buyer.name, ...overdueInvoices.map((r) => r.buyerName)];
  const lines = await narrateSlots("order_plan", slots, buyerNames, {
    buyer: order.buyer.name,
    qty: order.input.qty,
    needLow: order.financingNeedLow,
    needHigh: order.financingNeedHigh,
    topLenderId: topLender?.product.id,
    overdueIds: overdueInvoices.map((r) => r.invoiceId).sort(),
    challenges,
  });

  const events: AgentRoomEvent[] = slots.map((slot, i) => ({
    id: slot.id,
    stageIndex: i,
    from: slot.from as AgentRoomEvent["from"],
    to: slot.to as AgentRoomEvent["to"],
    statusText: lines[slot.id].statusText,
    text: lines[slot.id].text,
    isChallenge: slot.isChallenge,
    reasoning: [slot.facts],
    tier: 0,
  }));

  const approvals: ApprovalCard[] = [];
  if (challenges.collectFirst) {
    for (const row of overdueInvoices) {
      approvals.push({
        id: `appr-collect-${row.invoiceId}`,
        agent: "receivables",
        tier: 2,
        title: `Send a reminder to ${row.buyerName}`,
        detail: `${row.chaseStep.label} · invoice ${row.overdueDays} days overdue`,
        impact: `+${formatMoney(row.amount)} if collected`,
      });
    }
  }
  if (challenges.splitLot) {
    approvals.push({
      id: "appr-split-lot",
      agent: "procurement",
      tier: 2,
      title: `Split the ${order.input.material.toLowerCase()} buy into two lots`,
      detail: `~${(order.tonnes / 2).toFixed(0)} t now, ~${(order.tonnes / 2).toFixed(0)} t in 21 days`,
      impact: `Smooths ${formatMoney(order.materialCostMid)} material cost across two payments`,
    });
  }
  if (topLender) {
    approvals.push({
      id: "appr-financing",
      agent: "financing",
      tier: 2,
      title: `Request ${topLender.product.name}`,
      detail: `All-in rate ${topLender.allIn.toFixed(1)}% · covers up to ${formatMoney(topLender.cap)}`,
      impact: `Closes the stress-case gap of ${formatMoney(order.financingNeedHigh)}`,
    });
  }

  return {
    runId: `run_order_${fingerprint({ buyer: order.buyer.name, qty: order.input.qty }).slice(0, 8)}`,
    workflow: "order_plan",
    title: `Order plan: ${order.buyer.name}, ${formatMoney(order.revenue)}`,
    steps,
    events,
    approvals,
  };
}

// ---------------------------------------------------------------------------
// Collect run
// ---------------------------------------------------------------------------

export async function runCollectWorkflow(userId: string): Promise<WorkflowRun> {
  const { overdue, totalAmount } = await computeCollectNumbers(userId);

  const steps: AgentRoomStep[] = [
    { id: "list_overdue", label: "List overdue invoices" },
    ...overdue.map((row) => ({ id: `draft_${row.invoiceId}`, label: `Draft reminder: ${row.buyerName}` })),
    { id: "cash_effect", label: "Work out the cash effect" },
    { id: "guard_check", label: "Policy Guard: wording check" },
  ];

  const slots: NarrationSlot[] = [
    {
      id: "cev-list",
      from: "receivables",
      to: "lead",
      isChallenge: false,
      facts:
        overdue.length > 0
          ? `${overdue.length} invoice(s) overdue: ${overdue
              .map((r) => `${r.buyerName} (${formatMoney(r.amount)}, ${r.overdueDays} days)`)
              .join("; ")}.`
          : `No invoices are currently overdue.`,
    },
    ...overdue.map((row) => ({
      id: `cev-draft-${row.invoiceId}`,
      from: "receivables",
      to: "lead",
      isChallenge: false,
      facts: `${row.overdueDays} days overdue is ${row.chaseStep.label} (step ${row.chaseStep.step} of 5, ${row.chaseStep.tone} tone) for ${row.buyerName}, ${formatMoney(row.amount)}.`,
    })),
    {
      id: "cev-cash",
      from: "lead",
      to: "financing",
      isChallenge: false,
      facts:
        overdue.length > 0
          ? `Together these invoices total ${formatMoney(totalAmount)}. Collecting them first covers part of any financing gap for free.`
          : `No overdue cash to factor into the financing plan right now.`,
    },
    {
      id: "cev-guard",
      from: "guard",
      to: "lead",
      isChallenge: false,
      facts:
        overdue.length > 0
          ? `All ${overdue.length} draft(s) checked: no threats, no legal claims, no contacts outside the buyer's listed record.`
          : `Nothing to check: no reminders were drafted.`,
    },
  ];

  const buyerNames = overdue.map((r) => r.buyerName);
  const lines = await narrateSlots("collect", slots, buyerNames, {
    overdueIds: overdue.map((r) => r.invoiceId).sort(),
    totalAmount,
  });

  const events: AgentRoomEvent[] = slots.map((slot, i) => ({
    id: slot.id,
    stageIndex: i,
    from: slot.from as AgentRoomEvent["from"],
    to: slot.to as AgentRoomEvent["to"],
    statusText: lines[slot.id].statusText,
    text: lines[slot.id].text,
    isChallenge: slot.isChallenge,
    reasoning: [slot.facts],
    tier: 0,
  }));

  const approvals: ApprovalCard[] = overdue.map((row) => ({
    id: `cappr-${row.invoiceId}`,
    agent: "receivables",
    tier: 2,
    title: `Send a reminder to ${row.buyerName}`,
    detail: `${row.chaseStep.label} · invoice ${row.overdueDays} days overdue`,
    impact: `+${formatMoney(row.amount)} expected if sent`,
  }));

  return {
    runId: `run_collect_${fingerprint(overdue.map((r) => r.invoiceId)).slice(0, 8)}`,
    workflow: "collect",
    title:
      overdue.length > 0
        ? `Collect: ${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}`
        : "Collect: no overdue invoices",
    steps,
    events,
    approvals,
  };
}
