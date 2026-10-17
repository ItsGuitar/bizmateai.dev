// Builds one JSON snapshot of every number and decision the app currently has on screen: the
// forecast, the pending order, receivables, financing matches, and the trust/audit state. This is
// the "what the AI would read" file ahead of wiring up a real model: everything it would need to
// reason about this company lives in one place, already computed, nothing left for it to guess.
//
// Triggered by the DEV PROCESSING button on the Home dashboard (dev-only, removed before ship).

import {
  COMPANY,
  HEALTH,
  VITALS,
  FACTORY,
  RANKED_ISSUES,
  BIGGEST_MOVES,
  PAST_12_MONTHS,
  CASH_WEEKS,
  OPEN_INVOICES,
  PLATFORM,
  WEBANK_ECOSYSTEM_LINKS,
  SUPPLIER_POOL,
  GREEN_CHECK,
  CREDIT_PACKAGE_DOCS,
} from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import {
  BUYERS,
  MATERIALS,
  DEFAULT_ORDER_INPUT,
  AS_OF,
  checkOrder,
  computeSensitivities,
  getBuyerModel,
  gradeScore,
  gradeLetter,
  expectedOpenInvoicePayment,
  chaseStepForOverdue,
} from "@/lib/order-engine";
import {
  COMPANY_PROFILE,
  LENDER_CATALOG,
  matchLenders,
  negotiate,
  repaymentCheck,
} from "@/lib/financing-engine";
import { TIER_RULES, SELF_ASSESSMENT, MASKING_DEMO, AUDIT_ENTRIES_SEED } from "@/app/data/trust-mock";
import { computeChain, merkleRootOf, GENESIS_HASH } from "@/lib/audit-chain";

// Drops function values (e.g. LenderProduct.eligibility) so the result is always plain JSON.
export function stripFunctions(_key: string, value: unknown) {
  return typeof value === "function" ? undefined : value;
}

export async function buildAiContext() {
  const order = checkOrder(DEFAULT_ORDER_INPUT, "base");
  const sensitivities = computeSensitivities(DEFAULT_ORDER_INPUT);

  const buyers = BUYERS.map((buyer) => {
    const hasOverdue = OPEN_INVOICES.some((inv) => {
      if (inv.buyerName !== buyer.name) return false;
      const dueDate = new Date(`${inv.dueDate}T00:00:00Z`);
      return expectedOpenInvoicePayment(dueDate, buyer, AS_OF).overdueDays > 0;
    });
    const score = gradeScore(buyer.mu, buyer.sigma, hasOverdue);
    return { ...buyer, currentGrade: gradeLetter(score, buyer.n), currentScore: Math.round(score * 10) / 10, hasOverdue };
  });

  const openInvoices = OPEN_INVOICES.map((inv) => {
    const buyer = getBuyerModel(inv.buyerName);
    const dueDate = new Date(`${inv.dueDate}T00:00:00Z`);
    const payment = expectedOpenInvoicePayment(dueDate, buyer, AS_OF);
    return { ...inv, payment, chase: chaseStepForOverdue(payment.overdueDays) };
  });

  const financingNeed = VITALS.financingNeedLow;
  const poValue = order.revenue;
  const rateCeilingPct = order.rateCeilingPct;
  const matches = matchLenders(financingNeed, poValue, COMPANY_PROFILE, rateCeilingPct);
  const topMatch = matches[0];
  const principal = Math.min(financingNeed, topMatch.cap);
  const repayment = repaymentCheck(topMatch.product, principal, topMatch.allIn, CASH_WEEKS, VITALS.cushion);
  const negotiation = negotiate(topMatch.product, COMPANY_PROFILE, rateCeilingPct);

  const auditHashes = await computeChain(AUDIT_ENTRIES_SEED);
  const auditLog = {
    entries: AUDIT_ENTRIES_SEED.map((entry, i) => ({
      ...entry,
      prevHash: i === 0 ? GENESIS_HASH : auditHashes[i - 1],
      hash: auditHashes[i],
    })),
    merkleRoot: await merkleRootOf(auditHashes),
  };

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: "dev-processing-button",
      asOf: COMPANY.asOf,
      version: 1,
    },
    company: {
      ...COMPANY,
      health: HEALTH,
      vitals: VITALS,
      factory: FACTORY,
      pastTwelveMonths: PAST_12_MONTHS,
    },
    issues: RANKED_ISSUES,
    biggestMoves: BIGGEST_MOVES,
    cashForecast: CASH_WEEKS,
    order: {
      input: DEFAULT_ORDER_INPUT,
      check: order,
      sensitivities,
    },
    buyers,
    materials: MATERIALS,
    receivables: { openInvoices },
    financing: {
      companyProfile: COMPANY_PROFILE,
      catalog: LENDER_CATALOG,
      need: financingNeed,
      needStress: VITALS.financingNeedHigh,
      rateCeilingPct,
      matches,
      topMatch: { product: topMatch.product.id, principal, repayment, negotiation },
      platform: PLATFORM,
      webankEcosystem: WEBANK_ECOSYSTEM_LINKS,
      supplierPool: SUPPLIER_POOL,
      greenCheck: GREEN_CHECK,
      creditPackageDocs: CREDIT_PACKAGE_DOCS,
    },
    trust: {
      tiers: TIER_RULES,
      selfAssessment: SELF_ASSESSMENT,
      masking: MASKING_DEMO,
      auditLog,
    },
    agents: SUPPLIER_AGENTS,
  };
}
