// Order-check engine, following NEW_DESIGN.md Section 5.4 (order check) and 5.5 (scenarios).
// All money math lives here as plain deterministic functions; nothing here calls an LLM.
//
// Two formulas in the source spec are flagged as lost-in-paste and not safely reconstructible
// (the rate-ceiling solve in 5.4, and the buyer/price blend constants in 5.1/5.6 use the spec's
// own best-effort reconstruction). Where we approximate, it's noted inline: this engine is
// built for a demo/prototype, not wired to a real loan-pricing model.

export type Scenario = "bull" | "base" | "bear" | "custom";

export interface BuyerModel {
  name: string;
  mu: number; // mean payment delay past due date, days
  sigma: number; // sd of delay, days
  grade: "A" | "B" | "C" | "D" | "New";
  n: number; // paid invoices on file
}

export interface MaterialPrice {
  name: string;
  kgPerUnitDefault: number;
  lowPerTonne: number; // p10
  midPerTonne: number; // p50
  highPerTonne: number; // p90
}

// Portfolio prior from 5.1: m0 = 10 days, s0 = 12 days when a buyer has no history.
const PORTFOLIO_PRIOR = { mu: 10, sigma: 12 };

// `grade` here is the formula's own baseline (no current invoice overdue). The Receivables page
// shows the live score too, which does move when a buyer goes overdue (e.g. Shenzhen
// ElectroParts' p90 window is 9 + 1.2816 × 8 ≈ 19 days, so its invoice at 21 days overdue is
// past p90, "high risk"), matching the explanation on the Home dashboard. The flat -8
// overdue penalty drops its score from 82.9 (A) to 74.9 (B), a real grade drop, just A → B
// rather than the dashboard copy's B → C (that line is flavor text, not derived from this
// formula; the formula here is the source of truth for the Receivables page).
export const BUYERS: BuyerModel[] = [
  { name: "Guangzhou Motors", mu: 12, sigma: 11, grade: "B", n: 1 },
  { name: "Shenzhen ElectroParts", mu: 9, sigma: 8, grade: "A", n: 14 },
  { name: "Boutique Siam", mu: 18, sigma: 15, grade: "B", n: 6 },
  { name: "Hanoi Textiles Co.", mu: 4, sigma: 5, grade: "A", n: 22 },
  { name: "Chiang Mai Furniture", mu: 28, sigma: 22, grade: "C", n: 3 },
];

export function getBuyerModel(buyerName: string, buyers: BuyerModel[] = BUYERS): BuyerModel {
  const known = buyers.find((b) => b.name === buyerName);
  if (known) return known;
  return { name: buyerName || "New buyer", ...PORTFOLIO_PRIOR, grade: "New", n: 0 };
}

export const MATERIALS: MaterialPrice[] = [
  { name: "Cold-rolled steel", kgPerUnitDefault: 1.15, lowPerTonne: 4381, midPerTonne: 4482, highPerTonne: 4582 },
  { name: "Aluminium coil", kgPerUnitDefault: 0.6, lowPerTonne: 18200, midPerTonne: 18950, highPerTonne: 19700 },
  { name: "ABS resin", kgPerUnitDefault: 0.18, lowPerTonne: 9100, midPerTonne: 9400, highPerTonne: 9700 },
];

export function getMaterialPrice(materialName: string): MaterialPrice {
  return (
    MATERIALS.find((m) => m.name === materialName) ?? {
      name: materialName || "Custom material",
      kgPerUnitDefault: 1,
      lowPerTonne: 5000,
      midPerTonne: 5200,
      highPerTonne: 5400,
    }
  );
}

export interface OrderInput {
  buyerName: string;
  material: string;
  qty: number;
  pricePerUnit: number; // what the buyer pays per unit
  deliveryDate: string; // ISO yyyy-mm-dd
  termsDays: number; // buyer payment terms after delivery/invoice
  kgPerUnit: number;
  conversionCostPerUnit: number; // production cost per unit, not material
  supplierTermsDays: number; // days after procurement the supplier bill is due
}

export const DEFAULT_ORDER_INPUT: OrderInput = {
  buyerName: "Guangzhou Motors",
  material: "Cold-rolled steel",
  qty: 260000,
  pricePerUnit: 11.5,
  deliveryDate: "2026-11-15",
  termsDays: 45,
  kgPerUnit: 1.15,
  conversionCostPerUnit: 4.35,
  supplierTermsDays: 30,
};

export const AS_OF = new Date("2026-10-17T00:00:00Z");

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const Z_P10 = 1.2816;
const Z_P75 = 0.6745;

export interface BuyerPaymentWindow {
  expected: Date;
  p10: Date;
  p90: Date;
}

// 5.1, "not overdue" branch: this is always a future order, so that's the only branch we need.
export function expectedBuyerPayment(dueDate: Date, buyer: BuyerModel, z = 0): BuyerPaymentWindow {
  const delay = buyer.mu + z * buyer.sigma;
  return {
    expected: addDays(dueDate, delay),
    p10: addDays(dueDate, buyer.mu - Z_P10 * buyer.sigma),
    p90: addDays(dueDate, buyer.mu + Z_P10 * buyer.sigma),
  };
}

// 5.1 grade score: clamp(100 − 1.1 × max(0, μ) − 0.9 × σ − 8 if anything is overdue, 0, 100).
// A ≥ 80, B ≥ 62, C ≥ 45, D below; New when fewer than 2 paid invoices (score doesn't apply).
export function gradeScore(mu: number, sigma: number, hasOverdue: boolean): number {
  const raw = 100 - 1.1 * Math.max(0, mu) - 0.9 * sigma - (hasOverdue ? 8 : 0);
  return Math.max(0, Math.min(100, raw));
}

export function gradeLetter(score: number, n: number): BuyerModel["grade"] {
  if (n < 2) return "New";
  if (score >= 80) return "A";
  if (score >= 62) return "B";
  if (score >= 45) return "C";
  return "D";
}

export type InvoiceRisk = "none" | "late" | "high";

export interface OpenInvoicePayment {
  expected: Date;
  windowLo: Date;
  windowHi: Date;
  risk: InvoiceRisk;
  overdueDays: number;
}

// 5.1 expected payment of an open invoice: all three branches (this order's buyer-payment
// window above only needs the "not overdue" branch since it's always a future order; open
// invoices on the Receivables page can be in any of the three states).
export function expectedOpenInvoicePayment(dueDate: Date, buyer: BuyerModel, asOf: Date = AS_OF): OpenInvoicePayment {
  const overdueDays = Math.max(0, daysBetween(dueDate, asOf));
  const p90Days = buyer.mu + Z_P10 * buyer.sigma;
  const floor = addDays(asOf, 1);
  const clampFloor = (d: Date) => (d.getTime() < floor.getTime() ? floor : d);

  if (overdueDays === 0 && asOf.getTime() < dueDate.getTime()) {
    return {
      expected: clampFloor(addDays(dueDate, buyer.mu)),
      windowLo: clampFloor(addDays(dueDate, buyer.mu - Z_P10 * buyer.sigma)),
      windowHi: clampFloor(addDays(dueDate, buyer.mu + Z_P10 * buyer.sigma)),
      risk: "none",
      overdueDays: 0,
    };
  }

  if (overdueDays < p90Days) {
    return {
      expected: clampFloor(addDays(asOf, Math.max(5, buyer.mu - overdueDays + 4))),
      windowLo: clampFloor(addDays(asOf, 3)),
      windowHi: clampFloor(addDays(dueDate, p90Days + 10)),
      risk: "late",
      overdueDays,
    };
  }

  return {
    expected: clampFloor(addDays(asOf, Math.max(14, 1.5 * buyer.sigma))),
    windowLo: clampFloor(addDays(asOf, 5)),
    windowHi: clampFloor(addDays(asOf, 30 + 2 * buyer.sigma)),
    risk: "high",
    overdueDays,
  };
}

// Chase schedule (J4 / the `collect` workflow): a polite 5-step escalation ladder by days
// overdue. Not an explicit formula in the spec (the "5 steps" are named on the Receivables page
// row but never enumerated), so this is the tone progression consistent with the agent's own
// prohibited list (no threats, no legal claims) and the "Firm tone" reminder already drafted
// for Shenzhen ElectroParts at 21 days overdue on the Home dashboard (step 3 here).
export const CHASE_STEPS = [
  { step: 1, label: "Friendly reminder", tone: "Friendly", maxOverdueDays: 7 },
  { step: 2, label: "Follow-up nudge", tone: "Friendly", maxOverdueDays: 14 },
  { step: 3, label: "Firm reminder", tone: "Firm", maxOverdueDays: 21 },
  { step: 4, label: "Final notice", tone: "Firm", maxOverdueDays: 30 },
  { step: 5, label: "Escalate to Lead & Financing", tone: "Firm", maxOverdueDays: Infinity },
] as const;

export function chaseStepForOverdue(overdueDays: number): (typeof CHASE_STEPS)[number] {
  return CHASE_STEPS.find((s) => overdueDays <= s.maxOverdueDays) ?? CHASE_STEPS[CHASE_STEPS.length - 1];
}

// 5.3 "Plan: e-IOU discount" row: discounted today (as-of + 2) at 4.5%/year off face value.
export function eIouDiscountedAmount(faceValue: number, daysToMaturity: number): number {
  return faceValue * (1 - 0.045 * (Math.max(0, daysToMaturity) / 365));
}

export interface JourneyStep {
  id: string;
  label: string;
  date: Date;
  emoji: string;
}

export interface OrderCheckResult {
  input: OrderInput;
  buyer: BuyerModel;
  tonnes: number;
  procureDate: Date;
  supplierPayDate: Date;
  dueDate: Date;
  buyerPay: BuyerPaymentWindow;
  revenue: number;
  materialCostMid: number;
  materialCostLow: number;
  materialCostHigh: number;
  productionCost: number;
  profitMid: number;
  profitP10: number; // worst case: high material price
  profitP90: number; // best case: low material price
  cashGapDays: number;
  financingNeedLow: number;
  financingNeedHigh: number;
  termMonths: 3 | 6 | 9 | 12;
  rateCeilingPct: number; // approximation, see note at top of file
  comfortableRatePct: number; // approximation, see note at top of file
  verdict: "renegotiate" | "take_it" | "take_it_fixed_price" | "take_it_with_financing";
  journey: JourneyStep[];
}

function roundUp50k(n: number): number {
  return Math.max(0, Math.ceil(n / 50000) * 50000);
}

export function checkOrder(
  input: OrderInput,
  scenario: Scenario = "base",
  customDelayDays = 0,
  buyers: BuyerModel[] = BUYERS
): OrderCheckResult {
  const delivery = new Date(`${input.deliveryDate}T00:00:00Z`);
  const procureDate = new Date(Math.max(addDays(delivery, -25).getTime(), addDays(AS_OF, 3).getTime()));
  const tonnes = (input.qty * input.kgPerUnit) / 1000;
  const price = getMaterialPrice(input.material);
  const buyer = getBuyerModel(input.buyerName, buyers);
  const dueDate = addDays(delivery, input.termsDays);
  const supplierPayDate = addDays(procureDate, input.supplierTermsDays);

  // 5.5 scenario table: other-buyer z doesn't apply to a single order; this-buyer z and material
  // price do. Custom uses the owner's delay slider (days late) instead of a sigma multiple.
  let z = 0;
  let materialPricePerTonne = price.midPerTonne;
  if (scenario === "bull") {
    z = -Z_P75;
    materialPricePerTonne = price.lowPerTonne;
  } else if (scenario === "bear") {
    z = Z_P75 * 1.9; // approximates the spec's μ + 1.2816σ bear-case buyer delay
    materialPricePerTonne = price.highPerTonne;
  } else if (scenario === "custom") {
    materialPricePerTonne = price.midPerTonne;
  }

  const buyerPay =
    scenario === "custom"
      ? { expected: addDays(dueDate, customDelayDays), p10: addDays(dueDate, buyer.mu - Z_P10 * buyer.sigma), p90: addDays(dueDate, buyer.mu + Z_P10 * buyer.sigma) }
      : expectedBuyerPayment(dueDate, buyer, z);

  const revenue = input.qty * input.pricePerUnit;
  const materialCostMid = tonnes * price.midPerTonne;
  const materialCostLow = tonnes * price.lowPerTonne;
  const materialCostHigh = tonnes * price.highPerTonne;
  const productionCost = input.qty * input.conversionCostPerUnit;

  const scenarioMaterialCost = tonnes * materialPricePerTonne;
  const profitMid = revenue - materialCostMid - productionCost;
  const profitP10 = revenue - materialCostHigh - productionCost; // worst case
  const profitP90 = revenue - materialCostLow - productionCost; // best case
  const scenarioProfit = revenue - scenarioMaterialCost - productionCost;

  const cashGapDays = daysBetween(supplierPayDate, buyerPay.expected);

  // Financing need: the material cash tied up between paying the supplier and being paid.
  // Base case (mid price, expected buyer date) vs. stress case (high price, buyer at their p90
  // date). Production cost is left out here: 5.3 models it as a separate cost spread weekly
  // across production, not part of the acute supplier-payment gap this financing ask covers.
  //
  // This bracket is always computed off the BASE buyer model (z = 0), never the scenario's
  // shifted buyerPay. It's a fixed property of the order (5.4's own base-vs-stress need), not
  // a per-scenario number. Switching the scenario dropdown shouldn't change the money-needed
  // card; only the single-point profit/buyer-pay-date view below it.
  const baseBuyerPay = expectedBuyerPayment(dueDate, buyer, 0);
  const baseCashGapDays = daysBetween(supplierPayDate, baseBuyerPay.expected);
  const needLow = roundUp50k(materialCostMid);
  const stressMaterialCost = tonnes * price.highPerTonne;
  const stressGapDays = daysBetween(supplierPayDate, baseBuyerPay.p90);
  const stressFactor = Math.max(1, stressGapDays / Math.max(1, baseCashGapDays || 1));
  const needHigh = roundUp50k(stressMaterialCost * Math.min(2, stressFactor));

  const termCandidates: Array<3 | 6 | 9 | 12> = [3, 6, 9, 12];
  const neededDays = Math.max(stressGapDays, baseCashGapDays) + 7;
  const termMonths = termCandidates.find((m) => m * 30 >= neededDays) ?? 12;
  const termYears = termMonths / 12;

  // ⚠️ Approximation: NEW_DESIGN.md 5.4 flags the real rate-ceiling solve as lost in the
  // source doc ("pull the exact equation from c_engine.js before implementing"). This stand-in
  // spends a fixed slice (25%) of the order's profit on annualized interest and backs out the
  // rate that costs exactly that much over the term, so it scales sensibly with profit margin
  // and term length instead of just saturating at a clamp. "Comfortable" spends half as much,
  // off the worst-case (p10) profit instead of the base case.
  const INTEREST_BUDGET_SHARE = 0.25;
  const rateCeilingPct =
    needHigh > 0 ? Math.max(0, Math.min(60, ((profitMid * INTEREST_BUDGET_SHARE) / (needHigh * termYears)) * 100)) : 0;
  const comfortableRatePct =
    needHigh > 0
      ? Math.max(0, Math.min(rateCeilingPct, ((profitP10 * INTEREST_BUDGET_SHARE * 0.5) / (needHigh * termYears)) * 100))
      : 0;

  let verdict: OrderCheckResult["verdict"];
  if (profitMid <= 0) verdict = "renegotiate";
  else if (cashGapDays <= 0) verdict = "take_it";
  else if (profitP10 <= 0) verdict = "take_it_fixed_price";
  else verdict = "take_it_with_financing";

  const journey: JourneyStep[] = [
    { id: "take_order", label: "Take order", date: AS_OF, emoji: "📝" },
    { id: "buy_materials", label: "Buy materials", date: procureDate, emoji: "📦" },
    { id: "make", label: "Make", date: addDays(procureDate, Math.max(1, daysBetween(procureDate, delivery) / 2)), emoji: "🏭" },
    { id: "deliver_invoice", label: "Deliver & invoice", date: delivery, emoji: "🚚" },
    { id: "pay_supplier", label: "Pay supplier", date: supplierPayDate, emoji: "💸" },
    { id: "buyer_pays", label: "Buyer pays", date: buyerPay.expected, emoji: "🏦" },
  ];

  return {
    input,
    buyer,
    tonnes,
    procureDate,
    supplierPayDate,
    dueDate,
    buyerPay,
    revenue,
    materialCostMid,
    materialCostLow,
    materialCostHigh,
    productionCost,
    profitMid: scenarioProfit,
    profitP10,
    profitP90,
    cashGapDays,
    financingNeedLow: needLow,
    financingNeedHigh: needHigh,
    termMonths,
    rateCeilingPct,
    comfortableRatePct,
    verdict,
    journey,
  };
}

export interface SensitivityRow {
  label: string;
  profitDelta: number;
  // Pre-formatted secondary effect, if the shock's main side-effect isn't money (e.g. a buyer
  // paying later moves the cash-gap length, not the financing-need bracket, which is priced
  // off the material cost rather than timing). Omitted when there's no secondary effect to show.
  secondary?: string;
}

// Each row isolates one input shock against the base case, holding everything else fixed.
export function computeSensitivities(input: OrderInput): SensitivityRow[] {
  const base = checkOrder(input, "base");
  const price = getMaterialPrice(input.material);
  const tonnes = (input.qty * input.kgPerUnit) / 1000;

  const materialCostBump = tonnes * price.midPerTonne * 0.05;
  const sellingPriceBump = input.qty * input.pricePerUnit * 0.05;

  const qtyBump = checkOrder({ ...input, qty: Math.round(input.qty * 1.1) }, "base");

  const buyer = getBuyerModel(input.buyerName);
  const slowerBuyers = BUYERS.map((b) => (b.name === buyer.name ? { ...b, mu: b.mu + 15 } : b));
  const delayBump = checkOrder(input, "base", 0, slowerBuyers);

  return [
    { label: "Material price +5%", profitDelta: -materialCostBump, secondary: `need +${formatMoneyPlain(roundUp50k(materialCostBump))}` },
    { label: "Selling price +5%", profitDelta: sellingPriceBump },
    {
      label: "Order qty +10%",
      profitDelta: qtyBump.profitMid - base.profitMid,
      secondary: `need +${formatMoneyPlain(qtyBump.financingNeedHigh - base.financingNeedHigh)}`,
    },
    {
      label: "Buyer pays 15 days later",
      profitDelta: 0,
      secondary: `cash gap +${delayBump.cashGapDays - base.cashGapDays} days`,
    },
  ];
}

function formatMoneyPlain(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}
