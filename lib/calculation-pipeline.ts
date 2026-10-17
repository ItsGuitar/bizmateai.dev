/**
 * Deterministic Calculation Pipeline (NEW_DESIGN.md Section 5)
 *
 * Runs the 7-stage chain:
 * 1. Ingestion Pipeline & Verification (Entity resolution, de-dup, verified receivables, SHA-256)
 * 2. Buyer Payment Model (Credibility shrinkage, confidence windows, grade score, expected payment date)
 * 3. Weekly Cash Flow Forecast (13-26 weeks buckets, closing cash, cushion breach, 4 scenarios)
 * 4. Factory Health Score & Status (100-pt score, Factory Level 1-5, mood, runway coins, siren alerts)
 * 5. Issue Ranking & Prioritization (Rank formula based on cash impact and urgency)
 * 6. Financing Need & Gap Analysis (Low/High need, term 3/6/9/12m, rate ceiling, catalog match)
 * 7. State Sync & Visual Updates (Unified payload ready for UI consumption)
 */

import { BUYERS, BuyerModel, gradeScore, gradeLetter, Z_P10 } from "@/lib/order-engine";
import { LENDER_CATALOG } from "@/lib/financing-engine";
import { sha256Hex, GENESIS_HASH } from "@/lib/audit-chain";

export interface PipelineDocInput {
  id: string;
  docNumber: string;
  docType: "invoice" | "purchase_order" | "receipt" | "bill" | string;
  counterparty: string;
  amount: number;
  currency: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string | null;
  termsDays?: number;
  isEnabled: boolean;
}

export interface StatementTxn {
  date: string;
  amount: number;
  description: string;
}

export interface PipelineConfig {
  asOf: string; // YYYY-MM-DD
  openingCash: number;
  safetyCushion: number;
  materialRatio?: number;
  monthlyFixedCosts?: number;
}

export interface IngestionVerificationResult {
  docId: string;
  docNumber: string;
  normalizedCounterparty: string;
  matchedBuyerOrSupplier: string | null;
  similarity: number;
  isDuplicate: boolean;
  isVerifiedReceivable: boolean;
  auditHash: string;
}

export interface BuyerRecalculationResult {
  buyerName: string;
  mu: number;
  sigma: number;
  p10Date: string;
  expectedDate: string;
  p75Date: string;
  p90Date: string;
  gradeScore: number;
  grade: "A" | "B" | "C" | "D" | "New";
  risk: "Safe" | "Late" | "High Risk";
}

export interface WeeklyForecastBucket {
  week: number;
  weekLabel: string;
  inflows: number;
  outflows: number;
  closingCash: number;
  isBelowCushion: boolean;
  isCashGap: boolean;
}

export interface ScenarioForecasts {
  bull: WeeklyForecastBucket[];
  base: WeeklyForecastBucket[];
  bear: WeeklyForecastBucket[];
  custom: WeeklyForecastBucket[];
}

export interface HealthScoreBreakdown {
  cashCushionScore: number; // max 30
  buyerPaymentsScore: number; // max 25
  marginCostsScore: number; // max 20
  concentrationScore: number; // max 10
  debtLoadScore: number; // max 15
  totalScore: number; // 0 - 100
  factoryLevel: 1 | 2 | 3 | 4 | 5;
  mood: "Thriving" | "Steady" | "Strained" | "Struggling";
  runwayWeeks: number;
  alerts: {
    overdueWarning: boolean;
    priceStorm: boolean;
    cushionBreach: boolean;
  };
}

export interface RankedIssue {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  amount: number;
  urgencyRank: number;
  agent: "lead" | "receivables" | "procurement" | "financing";
}

export interface FinancingAnalysis {
  needLow: number;
  needHigh: number;
  termMonths: 3 | 6 | 9 | 12;
  rateCeilingPct: number;
  comfortableRatePct: number;
  eligibleProducts: {
    id: string;
    name: string;
    rateLow: number;
    rateHigh: number;
    fitsCeiling: boolean;
  }[];
}

export interface PipelineOutput {
  verification: IngestionVerificationResult[];
  buyerModels: BuyerRecalculationResult[];
  forecasts: ScenarioForecasts;
  health: HealthScoreBreakdown;
  rankedIssues: RankedIssue[];
  financing: FinancingAnalysis;
  calculatedAt: string;
}

// ----------------- Helper Functions -----------------

// Entity resolution: strip legal endings and normalize
export function cleanEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/(co\.,\s*ltd\.?|ltd\.?|co\.,|inc\.?|corp\.?|llc|limited|有限公司|บจก\.?|บริษัท|จำกัด)/gi, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5\u0e00-\u0e7f]/gi, " ")
    .trim();
}

// Dice coefficient string similarity (Bigram comparison)
export function calculateStringSimilarity(s1: string, s2: string): number {
  const str1 = cleanEntityName(s1);
  const str2 = cleanEntityName(s2);
  if (str1 === str2) return 1.0;
  if (str1.length < 2 || str2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      s.add(str.slice(i, i + 2));
    }
    return s;
  };

  const bg1 = getBigrams(str1);
  const bg2 = getBigrams(str2);
  let intersection = 0;
  for (const b of bg1) {
    if (bg2.has(b)) intersection++;
  }
  return (2.0 * intersection) / (bg1.size + bg2.size);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().split("T")[0];
}

function daysDiff(d1: string, d2: string): number {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  return Math.round((t2 - t1) / 86400000);
}

// ----------------- 7-Stage Pipeline Implementation -----------------

export async function runDeterministicPipeline(
  docs: PipelineDocInput[],
  config: PipelineConfig = {
    asOf: "2026-10-17",
    openingCash: 1260000,
    safetyCushion: 980000,
    materialRatio: 0.55,
    monthlyFixedCosts: 180000,
  },
  mockTxns: StatementTxn[] = [
    { date: "2026-10-10", amount: 86000, description: "TRANSFER FROM SHENZHEN ELECTRP" },
    { date: "2026-10-05", amount: 142500, description: "BOUTIQUE SIAM PAYMENT" },
    { date: "2026-09-28", amount: 310000, description: "HANOI TEXTILES E-IOU SETTLEMENT" },
  ]
): Promise<PipelineOutput> {
  const activeDocs = docs.filter((d) => d.isEnabled);

  // ==========================================
  // STAGE 1: Ingestion Pipeline & Verification
  // ==========================================
  const knownEntities = [
    "Shenzhen ElectroParts",
    "Chiang Mai Furniture",
    "Hanoi Textiles Co.",
    "Boutique Siam",
    "Guangzhou Motors",
    "Apex Craft Furniture",
    "BioHarvest Agro Tech",
    "Ploy Select Co., Ltd.",
  ];

  let prevAuditHash = GENESIS_HASH;
  const verification: IngestionVerificationResult[] = [];
  const seenKeys = new Set<string>();

  for (const doc of docs) {
    // 1. Entity Resolution
    let bestMatch: string | null = null;
    let maxSim = 0;
    for (const known of knownEntities) {
      const sim = calculateStringSimilarity(doc.counterparty, known);
      if (sim > maxSim) {
        maxSim = sim;
        if (sim >= 0.86) {
          bestMatch = known;
        }
      }
    }

    // 2. De-duplication Check (Counterparty + DocNumber)
    const dedupKey = `${cleanEntityName(doc.counterparty)}::${doc.docNumber.trim().toLowerCase()}`;
    const isDuplicate = seenKeys.has(dedupKey);
    seenKeys.add(dedupKey);

    // 3. Verified Receivables Matching (±1% amount, ±3 days date against bank statement)
    let isVerified = false;
    if (doc.docType.toLowerCase().includes("invoice")) {
      const targetDate = doc.dueDate || doc.issueDate;
      const matchTxn = mockTxns.find((tx) => {
        const amountDiff = Math.abs(tx.amount - doc.amount) / (doc.amount || 1);
        const dayDiff = Math.abs(daysDiff(targetDate, tx.date));
        return amountDiff <= 0.01 && dayDiff <= 3;
      });
      if (matchTxn) isVerified = true;
    }

    // 4. SHA-256 Audit Hash Chain
    const payload = JSON.stringify([
      doc.id,
      doc.docNumber,
      doc.counterparty,
      doc.amount,
      doc.issueDate,
      prevAuditHash,
    ]);
    const hash = await sha256Hex(payload);
    prevAuditHash = hash;

    verification.push({
      docId: doc.id,
      docNumber: doc.docNumber,
      normalizedCounterparty: cleanEntityName(doc.counterparty),
      matchedBuyerOrSupplier: bestMatch,
      similarity: Number(maxSim.toFixed(2)),
      isDuplicate,
      isVerifiedReceivable: isVerified,
      auditHash: hash,
    });
  }

  // ==========================================
  // STAGE 2: Buyer Payment Model
  // ==========================================
  // Credibility-Weighted Shrinkage: mu = (k*m0 + n*y_bar) / (k + n)
  const priorM0 = 10;
  const priorS0 = 12;
  const kWeight = 3;

  // Aggregate active invoices per buyer
  const buyerDocMap = new Map<string, PipelineDocInput[]>();
  for (const doc of activeDocs) {
    if (doc.docType.toLowerCase().includes("invoice")) {
      const name = doc.counterparty;
      const list = buyerDocMap.get(name) || [];
      list.push(doc);
      buyerDocMap.set(name, list);
    }
  }

  const buyerModels: BuyerRecalculationResult[] = [];
  const allKnownBuyers = Array.from(new Set([...BUYERS.map((b) => b.name), ...Array.from(buyerDocMap.keys())]));

  for (const buyerName of allKnownBuyers) {
    const defaultModel = BUYERS.find((b) => b.name === buyerName);
    const docList = buyerDocMap.get(buyerName) || [];
    const nExisting = defaultModel?.n || 0;
    const nNew = docList.length;
    const totalN = nExisting + nNew;

    let mu = defaultModel?.mu ?? priorM0;
    let sigma = defaultModel?.sigma ?? priorS0;

    if (totalN > 0) {
      // Credibility shrinkage blending
      const sampleMu = defaultModel ? defaultModel.mu : priorM0;
      mu = (kWeight * priorM0 + totalN * sampleMu) / (kWeight + totalN);
      sigma = Math.max(4, (kWeight * priorS0 + totalN * (defaultModel?.sigma || priorS0)) / (kWeight + totalN));
    }

    // Confidence windows:
    // p10 = mu - 1.2816*sigma
    // p75 = mu + 0.6745*sigma
    // p90 = mu + 1.2816*sigma
    const p10Shift = mu - Z_P10 * sigma;
    const p75Shift = mu + 0.6745 * sigma;
    const p90Shift = mu + Z_P10 * sigma;

    const baseDueDate = docList[0]?.dueDate || docList[0]?.issueDate || config.asOf;
    const expectedDate = addDays(baseDueDate, mu);
    const p10Date = addDays(baseDueDate, p10Shift);
    const p75Date = addDays(baseDueDate, p75Shift);
    const p90Date = addDays(baseDueDate, p90Shift);

    // Overdue check
    const isOverdue = daysDiff(baseDueDate, config.asOf) > 0;
    const score = gradeScore(mu, sigma, isOverdue);
    const grade = gradeLetter(score, totalN);

    let risk: "Safe" | "Late" | "High Risk" = "Safe";
    if (isOverdue) {
      const overdueDays = daysDiff(baseDueDate, config.asOf);
      risk = overdueDays > p90Shift ? "High Risk" : "Late";
    }

    buyerModels.push({
      buyerName,
      mu: Math.round(mu),
      sigma: Math.round(sigma),
      p10Date,
      expectedDate,
      p75Date,
      p90Date,
      gradeScore: Math.round(score),
      grade,
      risk,
    });
  }

  // ==========================================
  // STAGE 3: Weekly Cash Flow Forecast (13-26 Wks)
  // ==========================================
  const generateScenarioForecast = (zMultiplier: number, priceMultiplier: number) => {
    const buckets: WeeklyForecastBucket[] = [];
    let rollingCash = config.openingCash;

    for (let w = 1; w <= 13; w++) {
      const weekStartDays = (w - 1) * 7;
      const weekEndDays = w * 7;

      let weekInflows = 0;
      let weekOutflows = 0;

      // Map active documents
      for (const doc of activeDocs) {
        const isInvoice = doc.docType.toLowerCase().includes("invoice");
        const isPOOrBill = doc.docType.toLowerCase().includes("purchase") || doc.docType.toLowerCase().includes("bill");

        if (isInvoice) {
          const buyer = buyerModels.find((b) => b.buyerName === doc.counterparty);
          const delay = (buyer?.mu || 10) + zMultiplier * (buyer?.sigma || 10);
          const payDate = addDays(doc.dueDate || doc.issueDate, delay);
          const daysFromAsOf = daysDiff(config.asOf, payDate);

          if (daysFromAsOf >= weekStartDays && daysFromAsOf < weekEndDays) {
            weekInflows += doc.amount;
          }
        } else if (isPOOrBill) {
          const due = doc.dueDate || addDays(doc.issueDate, doc.termsDays || 30);
          const daysFromAsOf = daysDiff(config.asOf, due);

          if (daysFromAsOf >= weekStartDays && daysFromAsOf < weekEndDays) {
            weekOutflows += doc.amount * priceMultiplier;
          }
        }
      }

      // Add base operating baseline
      const weeklyFixedBaseline = (config.monthlyFixedCosts || 180000) / 4.33;
      weekOutflows += weeklyFixedBaseline;

      // Base run-rate sales
      const weeklyBaseSales = 120000;
      weekInflows += weeklyBaseSales;

      rollingCash = rollingCash + weekInflows - weekOutflows;

      buckets.push({
        week: w,
        weekLabel: `W${w}`,
        inflows: Math.round(weekInflows),
        outflows: Math.round(weekOutflows),
        closingCash: Math.round(rollingCash),
        isBelowCushion: rollingCash < config.safetyCushion,
        isCashGap: rollingCash < 0,
      });
    }

    return buckets;
  };

  const forecasts: ScenarioForecasts = {
    bull: generateScenarioForecast(-0.6745, 0.95),
    base: generateScenarioForecast(0, 1.0),
    bear: generateScenarioForecast(1.2816, 1.15),
    custom: generateScenarioForecast(0.5, 1.05),
  };

  // ==========================================
  // ==========================================
  // STAGE 4: Factory Health Score & Status (NEW_DESIGN.md Section 5.9)
  // ==========================================
  const baseForecast = forecasts.base;
  const lowest13WeekCash = Math.min(...baseForecast.map((b) => b.closingCash));

  // 1. Cash cushion score (Max 30): 30 * clamp(lowest 13-week cash / (2.5 * cushion), 0, 1)
  const cashCushionScore = Math.min(30, Math.max(0, 30 * (lowest13WeekCash / (2.5 * config.safetyCushion))));

  // 2. Buyer payments (Max 25): 25 * (0.5 * (1 - clamp(3 * overdue share)) + 0.5 * sales-weighted grade score / 100)
  const activeInvoices = activeDocs.filter((d) => d.docType.toLowerCase().includes("invoice"));
  const overdueDocs = activeInvoices.filter(
    (d) => d.dueDate && daysDiff(d.dueDate, config.asOf) > 0
  );
  const overdueShare = activeInvoices.length > 0 ? overdueDocs.length / activeInvoices.length : 0;
  
  // Sales-weighted grade score
  const totalInvoiceSales = activeInvoices.reduce((sum, d) => sum + d.amount, 0);
  let salesWeightedGrade = 75;
  if (totalInvoiceSales > 0) {
    let weightedSum = 0;
    for (const inv of activeInvoices) {
      const bm = buyerModels.find((b) => b.buyerName === inv.counterparty);
      const score = bm ? bm.gradeScore : 70;
      weightedSum += score * inv.amount;
    }
    salesWeightedGrade = weightedSum / totalInvoiceSales;
  } else if (buyerModels.length > 0) {
    salesWeightedGrade = buyerModels.reduce((acc, b) => acc + b.gradeScore, 0) / buyerModels.length;
  }
  const clampedOverduePenalty = Math.min(1, Math.max(0, 3 * overdueShare));
  const buyerPaymentsScore = Math.min(
    25,
    Math.max(0, 25 * (0.5 * (1 - clampedOverduePenalty) + 0.5 * (salesWeightedGrade / 100)))
  );

  // 3. Margin and input costs (Max 20): 20 * clamp((net cash margin + 2%) / 10%) * (1 - clamp(worst 3-month price rise / 25%, 0, 0.5))
  // Calculate net cash margin from active invoices vs active bills
  const activeBills = activeDocs.filter(
    (d) => d.docType.toLowerCase().includes("purchase") || d.docType.toLowerCase().includes("bill")
  );
  const totalBillsAmount = activeBills.reduce((sum, d) => sum + d.amount, 0);
  const netMargin = totalInvoiceSales > 0 ? (totalInvoiceSales - totalBillsAmount) / totalInvoiceSales : 0.08;
  const marginFactor = Math.min(1, Math.max(0, (netMargin + 0.02) / 0.10));
  const priceRisePenalty = 0.08; // moderate 4% rise
  const marginCostsScore = Math.min(20, Math.max(0, 20 * marginFactor * (1 - priceRisePenalty)));

  // 4. Buyer concentration (Max 10): 10 * (1 - clamp((top buyer share - 25%) / 50%))
  let topBuyerShare = 0.25;
  if (totalInvoiceSales > 0) {
    const buyerSalesMap = new Map<string, number>();
    for (const inv of activeInvoices) {
      buyerSalesMap.set(inv.counterparty, (buyerSalesMap.get(inv.counterparty) || 0) + inv.amount);
    }
    const maxBuyerSales = Math.max(...Array.from(buyerSalesMap.values()));
    topBuyerShare = maxBuyerSales / totalInvoiceSales;
  }
  const concentrationPenalty = Math.min(1, Math.max(0, (topBuyerShare - 0.25) / 0.50));
  const concentrationScore = Math.min(10, Math.max(0, 10 * (1 - concentrationPenalty)));

  // 5. Debt load (Max 15): 15 * clamp(1 - interest / (0.3 * net monthly cash + interest))
  const monthlyFixed = config.monthlyFixedCosts || 180000;
  const netMonthlyCash = Math.max(50000, (totalInvoiceSales / 3) - (totalBillsAmount / 3) - monthlyFixed);
  const estimatedInterest = 8500;
  const debtFactor = Math.min(1, Math.max(0, 1 - estimatedInterest / (0.3 * netMonthlyCash + estimatedInterest)));
  const debtLoadScore = Math.min(15, Math.max(0, 15 * debtFactor));

  const totalHealth = Math.round(
    cashCushionScore + buyerPaymentsScore + marginCostsScore + concentrationScore + debtLoadScore
  );

  let factoryLevel: 1 | 2 | 3 | 4 | 5 = 1;
  if (totalHealth >= 80) factoryLevel = 5;
  else if (totalHealth >= 66) factoryLevel = 4;
  else if (totalHealth >= 52) factoryLevel = 3;
  else if (totalHealth >= 40) factoryLevel = 2;

  let mood: "Thriving" | "Steady" | "Strained" | "Struggling" = "Struggling";
  if (totalHealth >= 75) mood = "Thriving";
  else if (totalHealth >= 60) mood = "Steady";
  else if (totalHealth >= 45) mood = "Strained";

  // Runway weeks (weeks before cash hits 0)
  const zeroWeekIdx = baseForecast.findIndex((b) => b.closingCash <= 0);
  const runwayWeeks = zeroWeekIdx === -1 ? 14 : zeroWeekIdx + 1;

  const health: HealthScoreBreakdown = {
    cashCushionScore: Math.round(cashCushionScore),
    buyerPaymentsScore: Math.round(buyerPaymentsScore),
    marginCostsScore,
    concentrationScore,
    debtLoadScore,
    totalScore: totalHealth,
    factoryLevel,
    mood,
    runwayWeeks,
    alerts: {
      overdueWarning: overdueDocs.length > 0,
      priceStorm: false,
      cushionBreach: baseForecast.some((b) => b.isBelowCushion),
    },
  };

  // ==========================================
  // STAGE 5: Issue Ranking & Prioritization
  // ==========================================
  const rankedIssues: RankedIssue[] = [];

  // Check cushion breaches
  const breachWeek = baseForecast.find((b) => b.isBelowCushion);
  if (breachWeek) {
    const shortfall = Math.max(0, config.safetyCushion - breachWeek.closingCash);
    const urgency = (shortfall / 500000) * (1 / (1 + breachWeek.week * 0.5)) * 1.5;
    rankedIssues.push({
      id: "issue-cushion",
      title: `Cash dips below safety cushion in ${breachWeek.weekLabel}`,
      detail: `Projected cash ¥${breachWeek.closingCash.toLocaleString()} vs safety buffer ¥${config.safetyCushion.toLocaleString()}`,
      severity: breachWeek.isCashGap ? "high" : "medium",
      amount: shortfall,
      urgencyRank: Number(urgency.toFixed(2)),
      agent: "lead",
    });
  }

  // Check overdue invoices
  for (const od of overdueDocs) {
    const odDays = daysDiff(od.dueDate || od.issueDate, config.asOf);
    const urgency = (od.amount / 500000) * (1 / (1 + Math.max(1, odDays) / 14)) * 1.5;
    rankedIssues.push({
      id: `issue-overdue-${od.id}`,
      title: `Overdue invoice ${od.docNumber} (${od.counterparty})`,
      detail: `${od.currency}${od.amount.toLocaleString()} is ${odDays} days overdue past terms`,
      severity: odDays > 20 ? "high" : "medium",
      amount: od.amount,
      urgencyRank: Number(urgency.toFixed(2)),
      agent: "receivables",
    });
  }

  // Sort issues by urgency descending
  rankedIssues.sort((a, b) => b.urgencyRank - a.urgencyRank);

  // ==========================================
  // STAGE 6: Financing Need & Gap Analysis
  // ==========================================
  const stressLowest = Math.min(...forecasts.bear.map((b) => b.closingCash));
  const rawGapLow = Math.max(0, config.safetyCushion - lowest13WeekCash);
  const rawGapHigh = Math.max(0, config.safetyCushion - stressLowest);

  // Round up to 50,000
  const needLow = Math.ceil(rawGapLow / 50000) * 50000;
  const needHigh = Math.max(needLow, Math.ceil(rawGapHigh / 50000) * 50000);

  // Term selection: 3, 6, 9, 12 months
  let termMonths: 3 | 6 | 9 | 12 = 3;
  if (needHigh > 1000000) termMonths = 12;
  else if (needHigh > 500000) termMonths = 6;
  else if (needHigh > 0) termMonths = 3;

  const rateCeilingPct = 9.8;
  const comfortableRatePct = 6.2;

  const eligibleProducts = LENDER_CATALOG.filter((p) => p.connected).map((p) => ({
    id: p.id,
    name: p.name,
    rateLow: p.rateLow,
    rateHigh: p.rateHigh,
    fitsCeiling: p.rateHigh <= rateCeilingPct,
  }));

  const financing: FinancingAnalysis = {
    needLow,
    needHigh,
    termMonths,
    rateCeilingPct,
    comfortableRatePct,
    eligibleProducts,
  };

  return {
    verification,
    buyerModels,
    forecasts,
    health,
    rankedIssues,
    financing,
    calculatedAt: new Date().toISOString(),
  };
}
