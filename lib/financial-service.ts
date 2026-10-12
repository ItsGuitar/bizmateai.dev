import fs from "fs";
import path from "path";

export interface TransactionMetadata {
  reference_no?: string;
  notes?: string;
  terminal_id?: string;
  qr_trace?: string;
  campaign_flag?: boolean;
  contract_id?: string;
  billing_ref?: string;
  ad_account?: string;
  batch_no?: string;
  batch_id?: string;
  po_number?: string;
  invoice_no?: string;
  payment_habit?: string;
  delay_days?: number;
  supplier_id?: string;
  cny_amount?: number;
  fx_rate?: number;
  recipient_bank?: string;
  verified_registry?: boolean;
  core_conflict_trigger?: boolean;
  safety_buffer_breach?: boolean;
  safety_buffer_threshold?: number;
  red_flag_type?: string;
  flagged_by?: string;
  detected_rule?: string;
  original_account?: string;
  spoofed_account?: string;
  status?: string;
  advertised_rate?: string;
  calculated_apr_by_true_cost?: number;
}

export interface Transaction {
  txn_id: string;
  datetime: string;
  channel: string;
  counterparty_name: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balance_after: number;
  category: string;
  metadata: TransactionMetadata;
}

export interface WeekForecast {
  week: string;
  date: string;
  startDate: string;
  endDate: string;
  balance: number;
  status: "safe" | "below" | "short";
  heightPercent: number;
  inflow: number;
  outflow: number;
  note?: string;
}

export interface DebtorHabit {
  name: string;
  habit: "EXCELLENT" | "HABITUAL_LATE";
  averageDelayDays: number;
  totalPaidPastYear: number;
  currentOverdueAmount: number;
  invoiceStatus: string;
}

export interface SupplierHistory {
  name: string;
  supplierId: string;
  totalTransfersCount: number;
  totalCnySpent: number;
  totalThbSpent: number;
  monthsActive: number;
  verifiedRail: boolean;
  pendingOrderCny: number;
  pendingOrderThb: number;
  pendingDueDate: string;
}

export interface HealthScoreFactor {
  name: string;
  score: number;
  weight: number;
  status: "EXCELLENT" | "GOOD" | "ATTENTION";
  evidence: string;
}

// Global cache for parsed statement
let cachedTransactions: Transaction[] | null = null;

export function getTransactions(): Transaction[] {
  if (cachedTransactions) return cachedTransactions;
  const filePath = path.join(process.cwd(), "data", "mock_financial_statement_365d.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`mock_financial_statement_365d.json not found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  cachedTransactions = JSON.parse(raw) as Transaction[];
  return cachedTransactions;
}

// PRD Reference Date: Monday, 12 October 2026, 09:41 AM ICT
export const REFERENCE_DATE_ISO = "2026-10-12T09:41:00+07:00";
export const SAFETY_BUFFER_THB = 80000.0;

/**
 * Returns latest transaction before or at reference date
 */
export function getCurrentStateAtReferenceDate() {
  const all = getTransactions();
  const pastTxns = all.filter((t) => t.datetime <= REFERENCE_DATE_ISO);
  const latest = pastTxns[pastTxns.length - 1];

  return {
    referenceDate: REFERENCE_DATE_ISO,
    currentCashBalance: latest ? latest.balance_after : 145000.0,
    formattedBalance: latest ? `฿${latest.balance_after.toLocaleString("th-TH", { maximumFractionDigits: 0 })}` : "฿145,000",
    safetyBuffer: SAFETY_BUFFER_THB,
    latestTransaction: latest,
    totalPastTransactionsCount: pastTxns.length,
  };
}

/**
 * Calculates 13-Week Cash Radar Forecast from 12 Oct 2026 to 10 Jan 2027
 */
export function calculate13WeekCashRadar(): WeekForecast[] {
  const all = getTransactions();
  const weeks: WeekForecast[] = [];

  // Week 1 starts Monday 12 Oct 2026
  const w1Start = new Date("2026-10-12T00:00:00+07:00");
  let runningBal = getCurrentStateAtReferenceDate().currentCashBalance;

  for (let w = 0; w < 13; w++) {
    const start = new Date(w1Start.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);

    const startISO = start.toISOString().split("T")[0];
    const endISO = end.toISOString().split("T")[0];

    const weekLabel = `W${w + 1}`;
    const dayStr = String(start.getDate()).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateLabel = `${dayStr} ${monthNames[start.getMonth()]}`;

    // Filter statement transactions within this window
    const weekTxns = all.filter(
      (t) => t.datetime >= `${startISO}T00:00:00+07:00` && t.datetime <= `${endISO}T23:59:59+07:00`
    );

    let inflow = 0;
    let outflow = 0;
    let note: string | undefined = undefined;

    if (weekTxns.length > 0) {
      weekTxns.forEach((t) => {
        if (t.type === "CREDIT") inflow += t.amount;
        else outflow += t.amount;
      });
      // The closing balance at end of this week is the last transaction's balance_after
      const lastTxn = weekTxns[weekTxns.length - 1];
      runningBal = lastTxn.balance_after;

      if (weekTxns.some((t) => t.metadata?.core_conflict_trigger)) {
        note = "Below ฿80k Buffer (Chen Tech ¥100k due)";
      }
    } else {
      // Future weeks (November - January) projected from average baseline:
      // Inflow avg ~฿85,000/wk (weekly platforms + QR), Outflow avg ~฿52,000/wk (fixed rent/payroll/ads)
      const baseInflow = 75000 + (w % 3) * 15000;
      const baseOutflow = 48000 + (w % 2) * 12000;
      inflow = baseInflow;
      outflow = baseOutflow;
      runningBal = runningBal + inflow - outflow;
    }

    inflow = Math.round(inflow);
    outflow = Math.round(outflow);
    const balance = Math.round(runningBal);

    let status: "safe" | "below" | "short" = "safe";
    if (balance <= 0) {
      status = "short";
    } else if (balance < SAFETY_BUFFER_THB) {
      status = "below";
    }

    // Relative bar height scaling for UI (max ~฿300,000)
    const heightPercent = Math.min(100, Math.max(18, Math.round((balance / 320000) * 100)));

    weeks.push({
      week: weekLabel,
      date: dateLabel,
      startDate: startISO,
      endDate: endISO,
      balance,
      status,
      heightPercent,
      inflow,
      outflow,
      note,
    });
  }

  return weeks;
}

/**
 * Calculates B2B Buyer Habits
 */
export function getBuyerHabits(): DebtorHabit[] {
  const all = getTransactions();

  // 1. Siam Gadget Hub
  const siamTxns = all.filter((t) => t.counterparty_name.includes("Siam Gadget Hub"));
  const siamTotal = siamTxns.reduce((sum, t) => sum + t.amount, 0);

  // 2. Boutique Siam
  const boutiqueTxns = all.filter((t) => t.counterparty_name.includes("Boutique Siam"));
  const boutiqueTotal = boutiqueTxns.reduce((sum, t) => sum + t.amount, 0);

  return [
    {
      name: "Siam Gadget Hub Co., Ltd.",
      habit: "EXCELLENT",
      averageDelayDays: 0,
      totalPaidPastYear: Math.round(siamTotal),
      currentOverdueAmount: 0,
      invoiceStatus: "PAID_ON_TIME",
    },
    {
      name: "Boutique Siam Partnership",
      habit: "HABITUAL_LATE",
      averageDelayDays: 21.4,
      totalPaidPastYear: Math.round(boutiqueTotal),
      currentOverdueAmount: 35000.0,
      invoiceStatus: "OVERDUE_21_DAYS",
    },
  ];
}

/**
 * Analyzes Cross-Border Supplier Verified Trade (Shenzhen Chen Tech)
 */
export function getSupplierHistory(): SupplierHistory {
  const all = getTransactions();
  const chenTxns = all.filter(
    (t) => t.counterparty_name.includes("Shenzhen Chen Tech") && t.category === "SUPPLIER_PURCHASE"
  );

  const completed = chenTxns.filter((t) => t.datetime <= REFERENCE_DATE_ISO);
  const pending = chenTxns.find((t) => t.datetime > REFERENCE_DATE_ISO);

  const totalThb = completed.reduce((sum, t) => sum + t.amount, 0);
  const totalCny = completed.reduce((sum, t) => sum + (t.metadata?.cny_amount || 0), 0);

  return {
    name: "Shenzhen Chen Tech Electronics Co., Ltd.",
    supplierId: "CHEN-TECH-SZ",
    totalTransfersCount: completed.length,
    totalCnySpent: Math.round(totalCny),
    totalThbSpent: Math.round(totalThb),
    monthsActive: 12,
    verifiedRail: true,
    pendingOrderCny: pending?.metadata?.cny_amount || 100000.0,
    pendingOrderThb: pending?.amount || 482500.0,
    pendingDueDate: pending?.datetime || "2026-10-26T10:00:00+07:00",
  };
}

/**
 * Computes 7-factor Financial Health Score from ledger signals
 */
export function getHealthScoreBreakdown() {
  const all = getTransactions();

  // Factor 1: Overdraft / Bounced check occurrences
  const overdraftIncidents = all.filter((t) => t.balance_after < 0).length;
  const f1Score = overdraftIncidents === 0 ? 100 : 30;

  // Factor 2: Debt-to-income & cash generation
  const credits = all.filter((t) => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
  const debits = all.filter((t) => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0);
  const ratio = credits / (debits || 1);
  const f2Score = ratio >= 1.0 ? 82 : 60;

  // Factor 3: Verified Supplier Trade longevity
  const chenCount = all.filter((t) => t.counterparty_name.includes("Shenzhen Chen Tech")).length;
  const f3Score = chenCount >= 5 ? 90 : 70;

  // Factor 4: Sales Channel Diversification
  const channels = new Set(all.map((t) => t.channel));
  const f4Score = channels.size >= 5 ? 88 : 75;

  // Factor 5: Debtor Payment Collection Regularity
  const f5Score = 68; // Pulled down by Boutique Siam habitual late payments

  // Factor 6: Cash Flow Buffer Adherence
  const bufferBreaches = all.filter((t) => t.balance_after < SAFETY_BUFFER_THB).length;
  const f6Score = bufferBreaches <= 15 ? 78 : 50;

  // Factor 7: Risk & Fraud Defense
  const blockedAnomalies = all.filter((t) => t.category === "SECURITY_ANOMALY_BLOCKED").length;
  const f7Score = blockedAnomalies >= 2 ? 95 : 80;

  const factors: HealthScoreFactor[] = [
    { name: "Zero Overdraft / Hygiene", score: f1Score, weight: 0.15, status: "EXCELLENT", evidence: "0 bounced checks or overdrafts in 366 days" },
    { name: "Debt-to-Income Stability", score: f2Score, weight: 0.15, status: "GOOD", evidence: `Operating ratio ${ratio.toFixed(2)}x across 12 months` },
    { name: "Verified Cross-Border Trade", score: f3Score, weight: 0.15, status: "EXCELLENT", evidence: "12-month unbroken trade history with Shenzhen Chen Tech" },
    { name: "Omnichannel Revenue Spread", score: f4Score, weight: 0.15, status: "EXCELLENT", evidence: `${channels.size} active sales channels (Shopee, TikTok, Lazada, QR)` },
    { name: "Debtor Regularity & Recovery", score: f5Score, weight: 0.15, status: "ATTENTION", evidence: "Boutique Siam 21-day average delay lowers score" },
    { name: "Operating Buffer Discipline", score: f6Score, weight: 0.15, status: "GOOD", evidence: "Preserves ฿80k buffer across routine cycles" },
    { name: "Risk Defense & Verification", score: f7Score, weight: 0.1, status: "EXCELLENT", evidence: "2 phishing and predatory loan attempts hard-blocked" },
  ];

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  return {
    overallScore, // 78
    ratingGrade: "Grade B+",
    creditStatus: "Prime MSME Credit Line Eligible",
    factors,
  };
}

/**
 * Returns security anomalies and intercepted scams
 */
export function getSecurityAnomalies() {
  const all = getTransactions();
  return all.filter((t) => t.category === "SECURITY_ANOMALY_BLOCKED");
}

/**
 * Full aggregated financial package
 */
export function getFinancialSummary() {
  const state = getCurrentStateAtReferenceDate();
  const cashRadarWeeks = calculate13WeekCashRadar();
  const buyerHabits = getBuyerHabits();
  const supplierHistory = getSupplierHistory();
  const healthScore = getHealthScoreBreakdown();
  const anomalies = getSecurityAnomalies();

  return {
    company: "Ploy Select Co., Ltd.",
    referenceDate: state.referenceDate,
    currentCashToday: state.currentCashBalance,
    formattedCurrentCash: state.formattedBalance,
    safetyBuffer: state.safetyBuffer,
    cashRadarWeeks,
    buyerHabits,
    supplierHistory,
    healthScore,
    anomaliesCount: anomalies.length,
    totalTransactionsInStatement: getTransactions().length,
  };
}
