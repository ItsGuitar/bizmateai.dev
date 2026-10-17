// Financing engine, following NEW_DESIGN.md Section 5.8 (match, repayment, negotiation) and the
// China pack's lender catalog (Section 9). All money math lives here as plain deterministic
// functions; nothing here calls an LLM. Rates are illustrative, not live product terms (Section
// 8's own trust note: "Wrong lender terms: rates labelled illustrative").

export interface CompanyProfile {
  yearsOperating: number;
  taxRating: "A" | "B" | "C";
  healthScore: number;
  hasConfirmedPOFromABBuyer: boolean;
  goodReceivablesAmount: number; // open invoices from A/B-grade buyers
  eIOUsHeldAmount: number;
  hasProperty: boolean;
  isGreenEligible: boolean;
}

// Matches the Home dashboard's company (Shenzhen Dragon Precision Manufacturing): health 78,
// green-eligible, a B tax rating, no A/B-grade buyer on the pending order yet (Guangzhou Motors
// is graded "New", so order financing is correctly NOT eligible on this order specifically).
export const COMPANY_PROFILE: CompanyProfile = {
  yearsOperating: 6,
  taxRating: "B",
  healthScore: 78,
  hasConfirmedPOFromABBuyer: false,
  goodReceivablesAmount: 516500, // Hanoi Textiles (A) + Boutique Siam (B) open invoices
  eIOUsHeldAmount: 374000, // Hanoi Textiles + Boutique Siam e-IOU invoices
  hasProperty: true,
  isGreenEligible: true,
};

export type CapType = "fixed" | "po_value_pct" | "good_receivables_pct" | "eious_pct";
export type RepaymentType = "interest_monthly_principal_at_end" | "one_payment_at_end" | "annuity" | "e_iou_discount";

export interface LenderProduct {
  id: string;
  name: string;
  nameLocal: string;
  rateLow: number; // annual %, illustrative
  rateHigh: number;
  feePct: number; // annual %, already yearly per the spec note on guarantee fees
  greenDiscountPct: number; // applies only to guaranteed/inclusive loans when green-eligible
  capType: CapType;
  capValue: number; // the fixed amount, or the percentage (0-1) depending on capType
  termMonths: number;
  repaymentType: RepaymentType;
  security: string;
  speedDays: number;
  documents: string[];
  eligibility: (profile: CompanyProfile) => string[]; // returns unmet requirements, [] = eligible
  connected: boolean; // false = design-only, nothing connected in the MVP (WeBank ecosystem)
  source: string;
}

// China pack catalog (NEW_DESIGN.md Section 9, "Lender catalog" row).
export const LENDER_CATALOG: LenderProduct[] = [
  {
    id: "inclusive-credit",
    name: "Inclusive credit loan",
    nameLocal: "普惠信用贷",
    rateLow: 4.5,
    rateHigh: 12,
    feePct: 0.2,
    greenDiscountPct: 0.2,
    capType: "fixed",
    capValue: 500000,
    termMonths: 12,
    repaymentType: "annuity",
    security: "Unsecured",
    speedDays: 3,
    documents: ["Business license", "Tax filing (last 12 months)"],
    eligibility: (p) => (p.yearsOperating < 2 ? ["At least 2 years operating"] : []),
    connected: true,
    source: "National Financing Credit Service Platform (信易贷)",
  },
  {
    id: "order-financing",
    name: "Order financing",
    nameLocal: "订单融资",
    rateLow: 5,
    rateHigh: 11,
    feePct: 0.3,
    greenDiscountPct: 0,
    capType: "po_value_pct",
    capValue: 0.7,
    termMonths: 6,
    repaymentType: "interest_monthly_principal_at_end",
    security: "Confirmed purchase order",
    speedDays: 5,
    documents: ["Confirmed PO", "Delivery contract"],
    eligibility: (p) => (p.hasConfirmedPOFromABBuyer ? [] : ["A confirmed PO from a Grade A or B buyer"]),
    connected: true,
    source: "National Financing Credit Service Platform (信易贷)",
  },
  {
    id: "receivables-pledge",
    name: "Receivables pledge",
    nameLocal: "应收账款质押",
    rateLow: 4.8,
    rateHigh: 10.5,
    feePct: 0.25,
    greenDiscountPct: 0,
    capType: "good_receivables_pct",
    capValue: 0.8,
    termMonths: 6,
    repaymentType: "one_payment_at_end",
    security: "Receivables from Grade A/B buyers",
    speedDays: 4,
    documents: ["Receivables list", "Buyer payment confirmation"],
    eligibility: (p) => (p.goodReceivablesAmount > 0 ? [] : ["Open receivables from a Grade A or B buyer"]),
    connected: true,
    source: "National Financing Credit Service Platform (信易贷)",
  },
  {
    id: "government-guaranteed",
    name: "Government-guaranteed loan",
    nameLocal: "政府担保贷款",
    rateLow: 3.8,
    rateHigh: 9,
    feePct: 0,
    greenDiscountPct: 0.2,
    capType: "fixed",
    capValue: 800000,
    termMonths: 12,
    repaymentType: "annuity",
    security: "Government guarantee",
    speedDays: 10,
    documents: ["Guarantee application", "Tax rating certificate"],
    eligibility: (p) => {
      const missing: string[] = [];
      if (p.yearsOperating < 2) missing.push("At least 2 years operating");
      if (p.taxRating === "C") missing.push("Tax rating A or B");
      return missing;
    },
    connected: true,
    source: "National Financing Credit Service Platform (信易贷)",
  },
  {
    id: "e-iou-discount",
    name: "e-IOU discounting",
    nameLocal: "电子欠条贴现",
    rateLow: 4.5,
    rateHigh: 4.5,
    feePct: 0,
    greenDiscountPct: 0,
    capType: "eious_pct",
    capValue: 0.95,
    termMonths: 1,
    repaymentType: "e_iou_discount",
    security: "Verified e-IOU",
    speedDays: 1,
    documents: ["e-IOU record"],
    eligibility: (p) => (p.eIOUsHeldAmount > 0 ? [] : ["At least one verified e-IOU on file"]),
    connected: true,
    source: "National Financing Credit Service Platform (信易贷)",
  },
  {
    id: "webank-weiyedai",
    name: "WeBank Weiyedai",
    nameLocal: "微业贷",
    rateLow: 10.8,
    rateHigh: 10.8,
    feePct: 0,
    greenDiscountPct: 0,
    capType: "fixed",
    capValue: 300000,
    termMonths: 12,
    repaymentType: "annuity",
    security: "Unsecured",
    speedDays: 7,
    documents: ["WeBank application", "Consent to share the credit package"],
    eligibility: () => [],
    connected: false,
    source: "WeBank, over 5 million SMEs applied by June 2024 (WeBank release). Placeholder rate: not connected in this build.",
  },
  {
    id: "online-bank-line",
    name: "Online working-capital line",
    nameLocal: "线上流动资金贷款",
    rateLow: 5.5,
    rateHigh: 13,
    feePct: 0.4,
    greenDiscountPct: 0,
    capType: "fixed",
    capValue: 1000000,
    termMonths: 6,
    repaymentType: "annuity",
    security: "Unsecured",
    speedDays: 2,
    documents: ["Bank statements (last 6 months)"],
    eligibility: () => [],
    connected: true,
    source: "National Financing Credit Service Platform (信易贷)",
  },
];

// 5.8: Rate = clamp(low + (high - low) × (1 - health/100) × 1.15, low, high).
export function rateForHealth(low: number, high: number, health: number): number {
  const raw = low + (high - low) * (1 - health / 100) * 1.15;
  return Math.max(low, Math.min(high, raw));
}

export function allInRate(rate: number, product: LenderProduct, profile: CompanyProfile): number {
  const greenDiscount = profile.isGreenEligible ? product.greenDiscountPct : 0;
  const discountedRate = Math.max(product.rateLow, rate - greenDiscount);
  // "one-off fees ÷ term in years; guarantee fees are already yearly" — our feePct values here
  // are all already-yearly (guarantee/service fees), so they add directly, not divided by term.
  return discountedRate + product.feePct;
}

export function capAmount(product: LenderProduct, profile: CompanyProfile, poValue: number): number {
  switch (product.capType) {
    case "fixed":
      return product.capValue;
    case "po_value_pct":
      return poValue * product.capValue;
    case "good_receivables_pct":
      return profile.goodReceivablesAmount * product.capValue;
    case "eious_pct":
      return profile.eIOUsHeldAmount * product.capValue;
  }
}

export interface MatchedProduct {
  product: LenderProduct;
  rate: number;
  allIn: number;
  cap: number;
  eligible: boolean;
  missing: string[];
  covers: boolean;
  fitsCeiling: boolean;
}

// Sort by eligible, covers the need, then lowest all-in rate (5.8).
export function matchLenders(
  need: number,
  poValue: number,
  profile: CompanyProfile,
  ceilingPct: number
): MatchedProduct[] {
  const matched = LENDER_CATALOG.map((product) => {
    const rate = rateForHealth(product.rateLow, product.rateHigh, profile.healthScore);
    const allIn = allInRate(rate, product, profile);
    const cap = capAmount(product, profile, poValue);
    const missing = product.eligibility(profile);
    return {
      product,
      rate,
      allIn,
      cap,
      eligible: missing.length === 0,
      missing,
      covers: cap >= need,
      fitsCeiling: allIn <= ceilingPct,
    };
  });

  return matched.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.covers !== b.covers) return a.covers ? -1 : 1;
    return a.allIn - b.allIn;
  });
}

export interface NegotiationResult {
  floor: number;
  bankAsk: number;
  counter: number;
  final: number;
  acceptableByAgent: boolean; // agent may accept alone only if within mandate; owner still approves
}

// 5.8 sandbox negotiation.
export function negotiate(
  product: LenderProduct,
  profile: CompanyProfile,
  mandateRatePct: number
): NegotiationResult {
  const rate = rateForHealth(product.rateLow, product.rateHigh, profile.healthScore);
  const floor = product.rateLow + (product.rateHigh - product.rateLow) * (1 - profile.healthScore / 100) * 0.55;
  const bankAsk = Math.min(product.rateHigh, rate + 0.4);
  const counter = Math.max(floor, bankAsk - 0.6);
  const final = Math.max(floor, (bankAsk + counter) / 2 - 0.1);
  const finalAllIn = final + product.feePct;
  return {
    floor,
    bankAsk,
    counter,
    final,
    acceptableByAgent: finalAllIn <= mandateRatePct,
  };
}

export type RepaymentStatus = "OK" | "Tight" | "Short";

export interface RepaymentCheckpoint {
  label: string;
  monthsFromNow: number;
  amount: number;
  cashAfter: number;
  status: RepaymentStatus;
}

function statusFor(cashAfter: number, cushion: number): RepaymentStatus {
  if (cashAfter >= cushion) return "OK";
  if (cashAfter >= 0) return "Tight";
  return "Short";
}

// Simplified repayment check: places each payment against the Home dashboard's own 26-week
// base-case forecast (already excludes this hypothetical loan) by converting months to the
// nearest forecast week, then subtracting the cumulative payments made so far.
export function repaymentCheck(
  product: LenderProduct,
  principal: number,
  allInRatePct: number,
  cashWeeks: Array<{ week: number; base: number }>,
  cushion: number
): RepaymentCheckpoint[] {
  const termMonths = product.termMonths;
  const weekForMonth = (m: number) => Math.min(cashWeeks.length, Math.max(1, Math.round((m * 52) / 12)));
  const cashAtWeek = (w: number) => cashWeeks.find((c) => c.week === w)?.base ?? cashWeeks[cashWeeks.length - 1].base;

  if (product.repaymentType === "e_iou_discount") {
    // Day-0 cash in, no repayment risk: the buyer pays the platform later, not us.
    return [
      {
        label: "Discounted today",
        monthsFromNow: 0,
        amount: -principal, // negative = cash in
        cashAfter: cashAtWeek(1) + principal,
        status: "OK",
      },
    ];
  }

  const monthlyRate = allInRatePct / 100 / 12;
  let payments: Array<{ month: number; amount: number }>;

  if (product.repaymentType === "annuity") {
    const n = termMonths;
    const payment = monthlyRate === 0 ? principal / n : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
    payments = [{ month: 1, amount: payment }, { month: termMonths, amount: payment }];
  } else if (product.repaymentType === "interest_monthly_principal_at_end") {
    const interest = principal * monthlyRate;
    payments = [{ month: 1, amount: interest }, { month: termMonths, amount: interest + principal }];
  } else {
    // one_payment_at_end: simple interest over the term.
    const lump = principal * (1 + (allInRatePct / 100) * (termMonths / 12));
    payments = [{ month: termMonths, amount: lump }];
  }

  let cumulative = 0;
  return payments.map(({ month, amount }, i) => {
    cumulative += amount;
    const week = weekForMonth(month);
    const cashAfter = cashAtWeek(week) - cumulative;
    return {
      label: i === 0 && payments.length > 1 ? "First payment" : "Final payment",
      monthsFromNow: month,
      amount,
      cashAfter,
      status: statusFor(cashAfter, cushion),
    };
  });
}
