import type { SupplierAgentId } from "./supplier-agents";

// Mock dataset for the Home and Agent room screens.
// Numbers follow the China golden-test sample in NEW_DESIGN.md Section 12:
// cushion ¥980k, financing need ¥650k-1.40M, term 6 months.

export const COMPANY = {
  name: "Shenzhen Dragon Precision Manufacturing Co., Ltd.",
  pack: "China" as const,
  currency: "¥",
  asOf: "17 Oct 2026",
};

export const HEALTH = {
  score: 78,
  level: 4, // 1-5, from 5.9: 1<40, 2>=40, 3>=52, 4>=66, 5>=80
  mood: "Thriving" as const, // >=75
};

export const VITALS = {
  cashNow: 1260000,
  cushion: 980000,
  runwayWeeks: 14,
  financingNeedLow: 650000,
  financingNeedHigh: 1400000,
};

export const FACTORY = {
  level: HEALTH.level,
  coins: VITALS.runwayWeeks,
  overdueWarning: true,
  priceStorm: true,
  greenEligible: true,
};

export interface RankedIssue {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  amount: number;
  agent: SupplierAgentId;
  explain: string;
}

export const RANKED_ISSUES: RankedIssue[] = [
  {
    id: "iss-1",
    title: "Shenzhen ElectroParts is 21 days overdue",
    detail: "¥86,000 outstanding · payment grade dropped B → C",
    severity: "high",
    amount: 86000,
    agent: "receivables",
    explain:
      "Shenzhen ElectroParts usually pays 12 days late. This invoice is already 21 days late, past their p90 window, so Receivables marked it high risk and is ready to draft a reminder once you approve.",
  },
  {
    id: "iss-2",
    title: "Guangzhou Motors order needs financing",
    detail: "¥720,000 order · cash gap opens 15 Nov",
    severity: "high",
    amount: 720000,
    agent: "lead",
    explain:
      "The new order is profitable, but materials must be paid before Guangzhou Motors pays you. Financing is comparing supplier terms, a bank line and e-IOU discounting to cover the gap at the lowest cost.",
  },
  {
    id: "iss-3",
    title: "Cold-rolled steel is up 4.2% this month",
    detail: "Lock-price window closes in 9 days",
    severity: "medium",
    amount: 0,
    agent: "procurement",
    explain:
      "Steel has risen for three months in a row. If the trend continues, the November lot gets more expensive the longer you wait. Procurement recommends locking the price now.",
  },
  {
    id: "iss-4",
    title: "Stress case dips below cushion in week 7",
    detail: "Lowest point ¥820,000 vs ¥980,000 cushion",
    severity: "medium",
    amount: 160000,
    agent: "lead",
    explain:
      "If other buyers pay at the slow end of their usual range and steel stays at the high end, cash dips ¥160,000 below your safety cushion in week 7. This is covered by the financing plan in issue 2.",
  },
];

export interface BiggestMove {
  id: string;
  text: string;
  direction: "up" | "down" | "flat";
}

export const BIGGEST_MOVES: BiggestMove[] = [
  { id: "mv-1", text: "Cold-rolled steel +4.2% this month", direction: "up" },
  { id: "mv-2", text: "Shenzhen ElectroParts grade B → C", direction: "down" },
  { id: "mv-3", text: "Safety margin 2 weeks tighter after the new order", direction: "down" },
  { id: "mv-4", text: "Guangzhou Motors order adds ¥720,000 revenue", direction: "up" },
];

export const PAST_12_MONTHS = {
  ordersFulfilled: 142,
  revenueInvoiced: 9840000,
  avgBuyerGrade: "B+",
};

export interface CashWeek {
  week: number;
  label: string;
  base: number;
  stress: number;
}

// 26 weeks: base case and stress case, in CNY. Dips below cushion (980,000) in the stress
// case around weeks 7-9 while the Guangzhou Motors order ties up cash, then recovers.
export const CASH_WEEKS: CashWeek[] = [
  { week: 1, label: "W1", base: 1260000, stress: 1260000 },
  { week: 2, label: "W2", base: 1205000, stress: 1180000 },
  { week: 3, label: "W3", base: 1150000, stress: 1090000 },
  { week: 4, label: "W4", base: 1300000, stress: 1210000 },
  { week: 5, label: "W5", base: 1265000, stress: 1140000 },
  { week: 6, label: "W6", base: 1120000, stress: 960000 },
  { week: 7, label: "W7", base: 1080000, stress: 890000 },
  { week: 8, label: "W8", base: 1040000, stress: 840000 },
  { week: 9, label: "W9", base: 1010000, stress: 820000 },
  { week: 10, label: "W10", base: 1150000, stress: 960000 },
  { week: 11, label: "W11", base: 1320000, stress: 1140000 },
  { week: 12, label: "W12", base: 1480000, stress: 1300000 },
  { week: 13, label: "W13", base: 1550000, stress: 1380000 },
  { week: 14, label: "W14", base: 1600000, stress: 1420000 },
  { week: 15, label: "W15", base: 1550000, stress: 1370000 },
  { week: 16, label: "W16", base: 1620000, stress: 1430000 },
  { week: 17, label: "W17", base: 1700000, stress: 1500000 },
  { week: 18, label: "W18", base: 1680000, stress: 1480000 },
  { week: 19, label: "W19", base: 1750000, stress: 1540000 },
  { week: 20, label: "W20", base: 1820000, stress: 1600000 },
  { week: 21, label: "W21", base: 1800000, stress: 1580000 },
  { week: 22, label: "W22", base: 1860000, stress: 1630000 },
  { week: 23, label: "W23", base: 1900000, stress: 1670000 },
  { week: 24, label: "W24", base: 1950000, stress: 1710000 },
  { week: 25, label: "W25", base: 2000000, stress: 1750000 },
  { week: 26, label: "W26", base: 2050000, stress: 1790000 },
];

// --- Agent room: the order_plan workflow run referenced in NEW_DESIGN.md Section 4 ---

export interface AgentRoomEvent {
  id: string;
  stageIndex: number;
  from: SupplierAgentId;
  to: SupplierAgentId;
  statusText: string;
  text: string;
  tool?: string;
  reasoning?: string[];
  isChallenge?: boolean;
  tier: 0 | 1 | 2 | 3;
}

export interface AgentRoomStep {
  id: string;
  label: string;
}

export interface ApprovalCard {
  id: string;
  agent: SupplierAgentId;
  tier: 2;
  title: string;
  detail: string;
  impact: string;
}

export const ORDER_PLAN_RUN = {
  runId: "run_8f2",
  workflow: "order_plan" as const,
  title: "Order plan: Guangzhou Motors, ¥720,000",
  steps: [
    { id: "read_order", label: "Read the new order" },
    { id: "cost", label: "Forecast material cost" },
    { id: "payment_timing", label: "When the buyer pays" },
    { id: "cash_impact", label: "Work out the cash impact" },
    { id: "financing_draft", label: "Draft financing options" },
    { id: "challenge_collect", label: "Challenge: collect first?" },
    { id: "challenge_split", label: "Challenge: split the lot?" },
    { id: "decide", label: "Pick the cheapest option" },
  ] satisfies AgentRoomStep[],
  events: [
    {
      id: "ev-1",
      stageIndex: 0,
      from: "lead",
      to: "procurement",
      statusText: "Reading the new order from Guangzhou Motors",
      text: "New order: 260,000 units, delivery 15 Nov, 45-day terms. Checking the material and cash plan before we quote back.",
      tool: "run_workflow('order_plan')",
      reasoning: ["Order qty 260,000 × 1.15 kg/unit = 299 t of cold-rolled steel", "Delivery 15 Nov, 45-day buyer terms"],
      tier: 0,
    },
    {
      id: "ev-2",
      stageIndex: 1,
      from: "procurement",
      to: "lead",
      statusText: "Forecasting the steel price for 15 Nov",
      text: "We need 299 t by 15 Nov. Expected ¥1.34M, range ¥1.31M–1.37M.",
      tool: "price_model('crc', '2026-11-15')",
      reasoning: ["260,000 units × 1.15 kg = 299 t", "Monthly log-return model on the cold-rolled steel price series", "3-month trend rising → price band widened"],
      tier: 0,
    },
    {
      id: "ev-3",
      stageIndex: 2,
      from: "receivables",
      to: "lead",
      statusText: "Checking when Guangzhou Motors usually pays",
      text: "Guangzhou Motors is a Grade B buyer, no payment history yet on this scale. Using the portfolio prior: expect payment 12 days after the due date, 45-day terms.",
      tool: "buyer_model('guangzhou_motors')",
      reasoning: ["Fewer than 2 paid invoices for this buyer → blended with the all-buyer prior (k = 3)", "Prior mean delay 10 days, portfolio sd 12 days"],
      tier: 0,
    },
    {
      id: "ev-4",
      stageIndex: 3,
      from: "lead",
      to: "financing",
      statusText: "Working out the cash impact",
      text: "Paying the supplier lands before Guangzhou Motors pays us. Base-case gap ¥650,000, stress-case gap up to ¥1,400,000 over 6 months.",
      tool: "forecast(weeks=26, order=guangzhou_motors)",
      reasoning: ["Supplier pay date: procure (21 Oct) + 30-day terms = 20 Nov", "Expected buyer payment: 15 Nov delivery + 45 terms + 12 days ≈ 11 Jan", "Cash gap ≈ 52 days"],
      tier: 0,
    },
    {
      id: "ev-5",
      stageIndex: 4,
      from: "financing",
      to: "lead",
      statusText: "Comparing financing options for the gap",
      text: "Three options so far: 60-day supplier terms (cheapest), a bank working-capital line at 7.8% all-in, and e-IOU discounting on verified receivables.",
      tool: "match_lenders(need=720000)",
      reasoning: ["Ranked by eligible → covers the need → lowest all-in rate", "Supplier terms need no financing cost, just a request to the supplier"],
      tier: 0,
    },
    {
      id: "ev-6",
      stageIndex: 5,
      from: "receivables",
      to: "lead",
      statusText: "Challenging the financing-first plan",
      text: "Before financing anything, Shenzhen ElectroParts owes ¥86,000, already 21 days overdue. Collecting that first covers part of the gap for free.",
      isChallenge: true,
      tool: "list_overdue()",
      reasoning: ["Shenzhen ElectroParts overdue by 21 days, past their p90 window → high risk, should be chased now regardless"],
      tier: 0,
    },
    {
      id: "ev-7",
      stageIndex: 6,
      from: "procurement",
      to: "lead",
      statusText: "Challenging the single-lot buy",
      text: "Also, splitting the steel buy into two lots 21 days apart smooths the cash outflow instead of paying for all 299 t at once.",
      isChallenge: true,
      tool: "plan_lots(material='crc', qty_t=299)",
      reasoning: ["Cash before paying the full lot is tight in week 7", "Two lots of ~150 t each, 21 days apart, keeps each payment smaller"],
      tier: 0,
    },
    {
      id: "ev-8",
      stageIndex: 7,
      from: "lead",
      to: "lead",
      statusText: "Re-running the forecast for each option",
      text: "Cheapest money first: collect the Shenzhen ElectroParts invoice, split the steel lot, and only request 60-day supplier terms for what's left. That covers the stress case without touching the bank line.",
      tool: "scenario_run(options=['collect_first','split_lot','supplier_terms'])",
      reasoning: ["Own cash + collections first, then supplier terms, then financing, in that order, cheapest to most expensive", "Combined plan keeps stress-case low point at ¥930,000, above the ¥980,000 cushion isn't fully met, flagged to the owner, not hidden"],
      tier: 0,
    },
  ] satisfies AgentRoomEvent[],
  approvals: [
    {
      id: "appr-1",
      agent: "receivables",
      tier: 2,
      title: "Send a reminder to Shenzhen ElectroParts",
      detail: "Firm tone · LINE + email · invoice 21 days overdue",
      impact: "+¥86,000 expected within 5 days of sending",
    },
    {
      id: "appr-2",
      agent: "procurement",
      tier: 2,
      title: "Split the November steel buy into two lots",
      detail: "150 t now, 149 t in 21 days · same supplier, same terms",
      impact: "Smooths ¥1.34M material cost across two payments",
    },
    {
      id: "appr-3",
      agent: "financing",
      tier: 2,
      title: "Request 60-day terms from the steel supplier",
      detail: "Covers the remaining gap · no financing fee",
      impact: "Closes the stress-case gap without a bank line",
    },
  ] satisfies ApprovalCard[],
};
