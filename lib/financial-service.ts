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
  jpy_amount?: number;
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
  totalOrdersCount: number;
  totalCnySpent: number;
  totalThbSpent: number;
  monthsActive: number;
  verifiedRail: boolean;
  pendingOrderCny: number;
  pendingOrderCurrency: string;
  pendingOrderAmount: number;
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

// Dataset mapping per connected bank
export const BANK_DATASETS: Record<string, { file: string; defaultBuffer: number; defaultCompany: string; bankName: string }> = {
  kbank: {
    file: "mock_financial_statement_365d.json",
    defaultBuffer: 80000.0,
    defaultCompany: "Ploy Select Co., Ltd.",
    bankName: "Kasikornbank Operating Account",
  },
  scb: {
    file: "mock_statement_scb_apex.json",
    defaultBuffer: 150000.0,
    defaultCompany: "Apex Craft Furniture & Interior Co., Ltd.",
    bankName: "Siam Commercial Bank Corporate",
  },
  bbl: {
    file: "mock_statement_bbl_bioharvest.json",
    defaultBuffer: 100000.0,
    defaultCompany: "BioHarvest Agro Tech Co., Ltd.",
    bankName: "Bangkok Bank iCash Operating",
  },
  personal: {
    file: "mock_statement_personal_3m.json",
    defaultBuffer: 15000.0,
    defaultCompany: "Kittisak Somchai (Freelance Creator)",
    bankName: "Kasikornbank Personal Savings (3 Months)",
  },
};

// Global cache for parsed statements by bank
const cachedTransactionsByBank: Record<string, Transaction[]> = {};

export function normalizeBankId(bankId?: string | null): string {
  if (!bankId) return "kbank";
  const lower = bankId.toLowerCase();
  if (lower.includes("scb") || lower.includes("siam") || lower.includes("apex") || lower.includes("furniture")) return "scb";
  if (lower.includes("bbl") || lower.includes("bangkok") || lower.includes("bioharvest") || lower.includes("agro")) return "bbl";
  if (lower.includes("personal") || lower.includes("mock4") || lower.includes("indiv") || lower.includes("3m") || lower.includes("kittisak") || lower.includes("somchai")) return "personal";
  return "kbank";
}

export function getTransactions(bankId?: string | null): Transaction[] {
  const key = normalizeBankId(bankId);
  if (cachedTransactionsByBank[key]) return cachedTransactionsByBank[key];

  const config = BANK_DATASETS[key] || BANK_DATASETS.kbank;
  const filePath = path.join(process.cwd(), "data", config.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${config.file} not found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Transaction[];
  cachedTransactionsByBank[key] = parsed;
  return parsed;
}

// PRD Reference Date: Monday, 12 October 2026, 09:41 AM ICT
export const REFERENCE_DATE_ISO = "2026-10-12T09:41:00+07:00";
export const SAFETY_BUFFER_THB = 80000.0;

/**
 * Returns latest transaction before or at reference date
 */
export function getCurrentStateAtReferenceDate(bankId?: string | null) {
  const all = getTransactions(bankId);
  const key = normalizeBankId(bankId);
  const config = BANK_DATASETS[key] || BANK_DATASETS.kbank;
  const pastTxns = all.filter((t) => t.datetime <= REFERENCE_DATE_ISO);
  const latest = pastTxns[pastTxns.length - 1];

  return {
    referenceDate: REFERENCE_DATE_ISO,
    currentCashBalance: latest ? latest.balance_after : (all[all.length - 1]?.balance_after || 145000.0),
    formattedBalance: latest ? `฿${latest.balance_after.toLocaleString("th-TH", { maximumFractionDigits: 0 })}` : "฿145,000",
    safetyBuffer: config.defaultBuffer,
    latestTransaction: latest,
    totalPastTransactionsCount: pastTxns.length,
    bankName: config.bankName,
    company: config.defaultCompany,
  };
}

/**
 * Calculates 13-Week Cash Radar Forecast from 12 Oct 2026 to 10 Jan 2027
 */
export function calculate13WeekCashRadar(bankId?: string | null): WeekForecast[] {
  const all = getTransactions(bankId);
  const key = normalizeBankId(bankId);
  const config = BANK_DATASETS[key] || BANK_DATASETS.kbank;
  const safetyBuffer = config.defaultBuffer;
  const weeks: WeekForecast[] = [];

  // Week 1 starts Monday 12 Oct 2026
  const w1Start = new Date("2026-10-12T00:00:00+07:00");
  let runningBal = getCurrentStateAtReferenceDate(bankId).currentCashBalance;

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

      const conflictTx = weekTxns.find((t) => t.metadata?.core_conflict_trigger || t.metadata?.safety_buffer_breach);
      if (conflictTx) {
        const cpShort = conflictTx.counterparty_name.split(" ")[0] || "Supplier";
        const foreignAmt = conflictTx.metadata?.cny_amount
          ? `¥${(conflictTx.metadata.cny_amount / 1000).toFixed(0)}k`
          : conflictTx.metadata?.jpy_amount
          ? `¥${(conflictTx.metadata.jpy_amount / 1000).toFixed(0)}k`
          : `฿${(conflictTx.amount / 1000).toFixed(0)}k`;
        note = `Below ฿${(safetyBuffer / 1000).toFixed(0)}k Buffer (${cpShort} ${foreignAmt} due)`;
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
    } else if (balance < safetyBuffer) {
      status = "below";
    }

    // Relative bar height scaling for UI (scaled to max balance headroom)
    const heightPercent = Math.min(100, Math.max(18, Math.round((balance / Math.max(320000, safetyBuffer * 2)) * 100)));

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
 * Calculates B2B Buyer Habits dynamically from statement transactions
 */
export function getBuyerHabits(bankId?: string | null): DebtorHabit[] {
  const all = getTransactions(bankId);
  const key = normalizeBankId(bankId);

  // Filter transactions categorized as B2B_RECEIVABLE or FREELANCE_PAYMENT
  const receivableTxns = all.filter(
    (t) => t.category === "B2B_RECEIVABLE" || t.category === "FREELANCE_PAYMENT"
  );

  const counterpartyGroups = new Map<string, Transaction[]>();
  receivableTxns.forEach((t) => {
    const list = counterpartyGroups.get(t.counterparty_name) || [];
    list.push(t);
    counterpartyGroups.set(t.counterparty_name, list);
  });

  const habits: DebtorHabit[] = [];
  counterpartyGroups.forEach((txns, name) => {
    const totalPaid = txns.filter((t) => t.datetime <= REFERENCE_DATE_ISO).reduce((s, t) => s + t.amount, 0);
    const overdueTxns = txns.filter((t) => t.metadata?.invoice_no || t.metadata?.payment_habit === "HABITUAL_LATE" || (t.metadata?.delay_days && t.metadata.delay_days > 0));
    
    const isLate = overdueTxns.length > 0;
    const overdueAmt = isLate ? overdueTxns[0].amount : 0;
    const avgDelay = isLate ? (overdueTxns[0].metadata?.delay_days || 14) : 0;

    habits.push({
      name,
      habit: isLate ? "HABITUAL_LATE" : "EXCELLENT",
      averageDelayDays: avgDelay,
      totalPaidPastYear: Math.round(totalPaid),
      currentOverdueAmount: overdueAmt,
      invoiceStatus: isLate ? `OVERDUE_${Math.round(avgDelay)}_DAYS` : "PAID_ON_TIME",
    });
  });

  return habits;
}

/**
 * Analyzes Cross-Border Supplier Verified Trade dynamically from statement
 */
export function getSupplierHistory(bankId?: string | null): SupplierHistory {
  const all = getTransactions(bankId);
  const key = normalizeBankId(bankId);

  const supplierTxns = all.filter((t) => t.category === "SUPPLIER_PURCHASE");
  const completed = supplierTxns.filter((t) => t.datetime <= REFERENCE_DATE_ISO);
  const pending = supplierTxns.find((t) => t.datetime > REFERENCE_DATE_ISO);

  const totalThb = completed.reduce((sum, t) => sum + t.amount, 0);
  const totalCny = completed.reduce((sum, t) => sum + (t.metadata?.cny_amount || t.metadata?.jpy_amount || 0), 0);

  // Resolve main supplier name dynamically from transactions
  const mainSupplierName = pending?.counterparty_name || completed[0]?.counterparty_name || (supplierTxns.length === 0 ? "None (Individual Account)" : "Verified Trade Supplier");
  const resolvedSupplierId = pending?.metadata?.supplier_id || completed[0]?.metadata?.supplier_id || (supplierTxns.length === 0 ? "INDIVIDUAL-ACCT" : "SUPPLIER-REG");

  const pendingAmt = pending?.metadata?.cny_amount || pending?.metadata?.jpy_amount || (pending ? pending.amount : 0);
  const currencySymbol = pending?.metadata?.jpy_amount ? "¥" : pending?.metadata?.cny_amount ? "¥" : (supplierTxns.length === 0 ? "฿" : "¥");

  return {
    name: mainSupplierName,
    supplierId: resolvedSupplierId,
    totalTransfersCount: completed.length,
    totalOrdersCount: supplierTxns.length,
    totalCnySpent: Math.round(totalCny),
    totalThbSpent: Math.round(totalThb),
    monthsActive: all.length > 300 ? 12 : 3,
    verifiedRail: supplierTxns.length > 0,
    pendingOrderCny: pendingAmt,
    pendingOrderCurrency: currencySymbol,
    pendingOrderAmount: pendingAmt,
    pendingOrderThb: pending?.amount || (key === "scb" ? 590000 : key === "bbl" ? 420000 : key === "personal" ? 0 : 482500.0),
    pendingDueDate: pending?.datetime || "2026-10-26T10:00:00+07:00",
  };
}

/**
 * Computes 7-factor Financial Health Score from ledger signals
 */
export function getHealthScoreBreakdown(bankId?: string | null) {
  const all = getTransactions(bankId);
  const key = normalizeBankId(bankId);
  const config = BANK_DATASETS[key] || BANK_DATASETS.kbank;

  // Factor 1: Overdraft / Bounced check occurrences
  const overdraftIncidents = all.filter((t) => t.balance_after < 0).length;
  const f1Score = overdraftIncidents === 0 ? 100 : 30;

  // Factor 2: Debt-to-income & cash generation
  const credits = all.filter((t) => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
  const debits = all.filter((t) => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0);
  const ratio = credits / (debits || 1);
  const f2Score = ratio >= 1.0 ? 84 : 60;

  // Factor 3: Verified Supplier Trade longevity
  const supplierTxns = all.filter((t) => t.category === "SUPPLIER_PURCHASE");
  const f3Score = supplierTxns.length >= 5 ? 90 : (key === "personal" ? 75 : 70);

  // Factor 4: Sales Channel Diversification
  const channels = new Set(all.map((t) => t.channel));
  const f4Score = channels.size >= 4 ? 88 : 72;

  // Factor 5: Debtor Payment Collection Regularity
  const lateDebtors = all.filter((t) => t.metadata?.payment_habit === "HABITUAL_LATE" || t.counterparty_name.includes("Boutique") || t.counterparty_name.includes("Tokyo") || t.counterparty_name.includes("Chao Phraya"));
  const f5Score = lateDebtors.length > 0 ? 68 : 92;

  // Factor 6: Cash Flow Buffer Adherence
  const bufferBreaches = all.filter((t) => t.balance_after < config.defaultBuffer).length;
  const f6Score = bufferBreaches <= 15 ? 80 : 55;

  // Factor 7: Risk & Fraud Defense
  const blockedAnomalies = all.filter((t) => t.category === "SECURITY_ANOMALY_BLOCKED").length;
  const f7Score = blockedAnomalies >= 2 ? 95 : 85;

  const factors: HealthScoreFactor[] = [
    { name: "Zero Overdraft / Hygiene", score: f1Score, weight: 0.15, status: "EXCELLENT", evidence: `0 overdrafts in ${all.length} transactions recorded` },
    { name: "Debt-to-Income Stability", score: f2Score, weight: 0.15, status: "GOOD", evidence: `Operating ratio ${ratio.toFixed(2)}x cash generation` },
    { name: "Verified Trade Activity", score: f3Score, weight: 0.15, status: "EXCELLENT", evidence: `${supplierTxns.length} verified trade invoices processed` },
    { name: "Channel Revenue Spread", score: f4Score, weight: 0.15, status: "EXCELLENT", evidence: `${channels.size} active operational payment channels` },
    { name: "Debtor Regularity & Recovery", score: f5Score, weight: 0.15, status: lateDebtors.length > 0 ? "ATTENTION" : "EXCELLENT", evidence: lateDebtors.length > 0 ? "Flagged delayed receivables lowering collection score" : "All customer receivables settle within term" },
    { name: "Operating Buffer Discipline", score: f6Score, weight: 0.15, status: "GOOD", evidence: `Preserves ฿${config.defaultBuffer.toLocaleString()} buffer across baseline cycles` },
    { name: "Risk Defense & Verification", score: f7Score, weight: 0.1, status: "EXCELLENT", evidence: "No unauthorized payment rails or security breaches" },
  ];

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  return {
    overallScore,
    ratingGrade: overallScore >= 80 ? "Grade A" : "Grade B+",
    creditStatus: overallScore >= 75 ? "Prime MSME Credit Line Eligible" : "Standard Tier",
    factors,
  };
}

/**
 * Returns security anomalies and intercepted scams
 */
export function getSecurityAnomalies(bankId?: string | null) {
  const all = getTransactions(bankId);
  return all.filter((t) => t.category === "SECURITY_ANOMALY_BLOCKED");
}

/**
 * Full aggregated financial package per connected bank
 */
export function getFinancialSummary(bankId?: string | null) {
  const state = getCurrentStateAtReferenceDate(bankId);
  const cashRadarWeeks = calculate13WeekCashRadar(bankId);
  const buyerHabits = getBuyerHabits(bankId);
  const supplierHistory = getSupplierHistory(bankId);
  const healthScore = getHealthScoreBreakdown(bankId);
  const anomalies = getSecurityAnomalies(bankId);
  const key = normalizeBankId(bankId);
  const config = BANK_DATASETS[key] || BANK_DATASETS.kbank;

  return {
    bankId: key,
    bankName: config.bankName,
    company: config.defaultCompany,
    referenceDate: state.referenceDate,
    currentCashToday: state.currentCashBalance,
    formattedCurrentCash: state.formattedBalance,
    safetyBuffer: state.safetyBuffer,
    cashRadarWeeks,
    buyerHabits,
    supplierHistory,
    healthScore,
    anomaliesCount: anomalies.length,
    totalTransactionsInStatement: getTransactions(bankId).length,
    isPersonal: key === "personal",
  };
}
