"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import {
  COMPANY,
  VITALS,
  CASH_WEEKS,
  PAST_12_MONTHS,
  PLATFORM,
  WEBANK_ECOSYSTEM_LINKS,
  SUPPLIER_POOL,
  GREEN_CHECK,
  CREDIT_PACKAGE_DOCS,
} from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import { DEFAULT_ORDER_INPUT, checkOrder, formatDate } from "@/lib/order-engine";
import {
  COMPANY_PROFILE,
  matchLenders,
  negotiate,
  repaymentCheck,
  type LenderProduct,
  type MatchedProduct,
  type RepaymentStatus,
} from "@/lib/financing-engine";

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${COMPANY.currency}${Math.abs(Math.round(n)).toLocaleString()}`;
}

function formatCompactMoney(n: number): string {
  if (n >= 1_000_000) return `${COMPANY.currency}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${COMPANY.currency}${(n / 1_000).toFixed(0)}K`;
  return `${COMPANY.currency}${Math.round(n)}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

const CHART_LOGICAL_WIDTH = 1000;
const CHART_HEIGHT = 180;

const REPAYMENT_STATUS_STYLE: Record<RepaymentStatus, string> = {
  OK: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300",
  Tight: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300",
  Short: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300",
};

type RepaymentType_ = LenderProduct["repaymentType"];

const REPAYMENT_LABEL: Record<RepaymentType_, string> = {
  interest_monthly_principal_at_end: "Interest monthly, principal at end",
  one_payment_at_end: "One payment at the end",
  annuity: "Equal monthly payments",
  e_iou_discount: "e-IOU discount, paid today",
};

type SecurityCategory = "None" | "Guarantee" | "Receivables" | "Property";
const SECURITY_CATEGORIES: SecurityCategory[] = ["None", "Guarantee", "Receivables", "Property"];

function securityCategory(security: string): SecurityCategory {
  const s = security.toLowerCase();
  if (s.includes("guarantee")) return "Guarantee";
  if (s.includes("receivable") || s.includes("e-iou") || s.includes("purchase order")) return "Receivables";
  if (s.includes("property")) return "Property";
  return "None";
}

export default function FinancingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [needCase, setNeedCase] = useState<"base" | "stress">("base");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [negotiateProduct, setNegotiateProduct] = useState<MatchedProduct | null>(null);
  const [requestedProducts, setRequestedProducts] = useState<Set<string>>(new Set());

  const order = useMemo(() => checkOrder(DEFAULT_ORDER_INPUT, "base"), []);

  const [mandate, setMandate] = useState({
    maxAmount: VITALS.financingNeedHigh,
    maxRatePct: Math.round(order.rateCeilingPct * 10) / 10,
    maxTermMonths: order.termMonths as number,
    securityAllowed: { None: true, Guarantee: true, Receivables: true, Property: true } as Record<
      SecurityCategory,
      boolean
    >,
  });

  const [readyDocs, setReadyDocs] = useState<Set<string>>(new Set());
  const [packageBuilt, setPackageBuilt] = useState(false);

  const [calcResult, setCalcResult] = useState<any>(null);

  React.useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);

    (async () => {
      try {
        const res = await fetch("/api/documents/calculate");
        const data = await res.json();
        if (data.success && data.hasCalculation) {
          setCalcResult(data.result);
        }
      } catch (err) {
        console.error("Financing calc load error:", err);
      }
    })();

    const handleCalc = (e: any) => {
      if (e.detail?.result) setCalcResult(e.detail.result);
    };
    window.addEventListener("bizmate_calculated", handleCalc);
    return () => window.removeEventListener("bizmate_calculated", handleCalc);
  }, [router]);

  // Dynamic financing need and cash forecast
  const dynamicNeedLow = calcResult?.financing?.needLow ?? VITALS.financingNeedLow;
  const dynamicNeedHigh = calcResult?.financing?.needHigh ?? VITALS.financingNeedHigh;
  const dynamicCeiling = calcResult?.financing?.rateCeilingPct ?? Math.round(order.rateCeilingPct * 10) / 10;
  const dynamicHealth = calcResult?.health?.totalScore ?? COMPANY_PROFILE.healthScore;

  const dynamicCompanyProfile = useMemo(
    () => ({
      ...COMPANY_PROFILE,
      healthScore: dynamicHealth,
    }),
    [dynamicHealth]
  );

  const dynamicCashWeeks = useMemo(() => {
    if (calcResult?.forecasts?.base) {
      return calcResult.forecasts.base.map((b: any, idx: number) => ({
        week: b.week,
        label: b.weekLabel,
        base: b.closingCash,
        stress: calcResult.forecasts.bear?.[idx]?.closingCash || b.closingCash,
      }));
    }
    return CASH_WEEKS;
  }, [calcResult]);

  const need = needCase === "base" ? dynamicNeedLow : dynamicNeedHigh;
  const poValue = order.revenue;

  const matches = useMemo(
    () => matchLenders(need, poValue, dynamicCompanyProfile, mandate.maxRatePct || dynamicCeiling),
    [need, poValue, dynamicCompanyProfile, mandate.maxRatePct, dynamicCeiling]
  );

  const selected = matches.find((m) => m.product.id === selectedProductId) ?? matches[0];
  const principal = Math.min(need, selected.cap);
  const repayment = useMemo(
    () => repaymentCheck(selected.product, principal, selected.allIn, dynamicCashWeeks, VITALS.cushion),
    [selected, principal, dynamicCashWeeks]
  );

  // Weekly "with this loan" line for the repayment chart: the draw adds the principal in week 1
  // (e-IOU discounting pays out immediately instead, so it has no separate draw event), then each
  // checkpoint's payment subtracts from cash at its own forecast week. Matches the same
  // month-to-week rounding repaymentCheck uses internally, so the chart lines up with the cards.
  const weekForMonth = (m: number) => Math.min(dynamicCashWeeks.length, Math.max(1, Math.round((m * 52) / 12)));
  const repaymentChart = useMemo(() => {
    const events: Array<{ week: number; delta: number }> = [];
    if (selected.product.repaymentType !== "e_iou_discount") {
      events.push({ week: 1, delta: principal });
    }
    const paymentWeeks = new Set<number>();
    repayment.forEach((cp) => {
      const week = weekForMonth(cp.monthsFromNow);
      events.push({ week, delta: -cp.amount });
      paymentWeeks.add(week);
    });
    const sorted = [...events].sort((a, b) => a.week - b.week);
    let cum = 0;
    let cursor = 0;
    const weeks = CASH_WEEKS.map((w) => {
      while (cursor < sorted.length && sorted[cursor].week <= w.week) {
        cum += sorted[cursor].delta;
        cursor += 1;
      }
      return { week: w.week, label: w.label, withoutLoan: w.base, withLoan: w.base + cum };
    });
    return { weeks, paymentWeeks };
  }, [selected, principal, repayment]);

  const lowestCashAfterPayment = Math.min(...repayment.map((c) => c.cashAfter));
  const shortPayments = repayment.filter((c) => c.status === "Short").length;
  // repaymentCheck only returns a first/final sample for annuity and interest-monthly loans, not
  // every monthly payment, so the total has to be reconstructed per repayment type rather than
  // just summed from the checkpoints (summing the 2 samples would hugely understate annuity loans
  // and double-count the interest-monthly ones).
  const totalInterestAndFees = (() => {
    const product = selected.product;
    if (product.repaymentType === "e_iou_discount") return null;
    if (product.repaymentType === "annuity") {
      const payment = repayment[0]?.amount ?? 0;
      return payment * product.termMonths - principal;
    }
    if (product.repaymentType === "interest_monthly_principal_at_end") {
      const interest = repayment[0]?.amount ?? 0;
      return interest * product.termMonths;
    }
    // one_payment_at_end: a single lump sum covering principal + interest.
    const lump = repayment[repayment.length - 1]?.amount ?? 0;
    return lump - principal;
  })();

  if (isChecking) {
    return null;
  }

  const financing = SUPPLIER_AGENTS.financing;
  const footprintPerMillion = GREEN_CHECK.footprintTonnesCO2e / (PAST_12_MONTHS.revenueInvoiced / 1_000_000);

  const handleAskForApproval = (match: MatchedProduct) => {
    setRequestedProducts((prev) => new Set(prev).add(match.product.id));
    setToastMessage(`Sent for your approval: ${match.product.name}. Nothing is signed yet.`);
    setNegotiateProduct(null);
  };

  const handleFindFinancing = () => {
    setToastMessage(`Best fit: ${matches[0].product.name} at ${formatPct(matches[0].allIn)} all-in.`);
  };

  const handleAskFinancing = () => {
    setToastMessage("Chat is coming soon.");
  };

  const handlePostDemand = () => {
    setToastMessage(
      `Posted. ${matches.filter((m) => m.eligible).length} lenders matched your ${formatMoney(need)} request.`
    );
  };

  const toggleDoc = (id: string) => {
    setReadyDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const readyCount = CREDIT_PACKAGE_DOCS.filter(
    (d) => d.preparedBy === "bizmate" || readyDocs.has(d.id)
  ).length;

  const handleBuildPackage = () => {
    setPackageBuilt(true);
    setToastMessage(`Package built: ${readyCount} of ${CREDIT_PACKAGE_DOCS.length} documents ready.`);
  };

  const handleShareWithLender = () => {
    setToastMessage(`Shared with ${selected.product.name}.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <div className="animate-fade-in-up">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-1 cursor-pointer inline-flex items-center gap-1"
          >
            <span>←</span>
            <span>Back to Home</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Financing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Finds the cheapest loan for the {order.input.buyerName} order and checks you can repay
            it. Rates shown here are estimates, not live offers.
          </p>
        </div>

        {/* Agent bar */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center p-1.5 shrink-0 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50">
              <Image
                src={financing.botAvatar}
                alt={financing.name}
                width={44}
                height={44}
                className="w-full h-full object-contain select-none pointer-events-none"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{financing.name}</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  AI agent
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                I find and compare loans, check repayments, and prepare your documents.
              </p>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate mt-0.5">
                Best fit right now: {matches[0].product.name} at {formatPct(matches[0].allIn)} all-in.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {([
                { key: "base" as const, label: "Base case" },
                { key: "stress" as const, label: "Stress case" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setNeedCase(opt.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    needCase === opt.key
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleFindFinancing}
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Find financing for me
            </button>
            <button
              type="button"
              onClick={handleAskFinancing}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Ask Financing
            </button>
          </div>
        </div>

        {/* What you need + Platform */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="animate-fade-in-up delay-150 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">What you need</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              From the order check and the cash forecast
            </p>

            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {formatMoney(need)}
              {needCase === "base" && (
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                  {" "}
                  to {formatMoney(VITALS.financingNeedHigh)}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              for {order.termMonths} months, from {formatDate(order.supplierPayDate)}
            </p>

            <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Purpose</span>
                <span className="font-semibold text-slate-900 dark:text-white text-right">
                  {order.input.buyerName} order, {formatMoney(order.revenue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Repaid by</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  Buyer payment ~{formatDate(order.buyerPay.expected)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Highest rate that still pays</span>
                <span className="font-black text-rose-600 dark:text-rose-400">{formatPct(order.rateCeilingPct)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Benchmark</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {PLATFORM.benchmarkLabel} {formatPct(PLATFORM.benchmarkPct)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{PLATFORM.benchmarkSource}</p>
            </div>

            {GREEN_CHECK.eligibleCandidate && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-sm">
                <span className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">
                  🌱
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Green Eligible Candidate</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Can lower the rate on some products.</span>
              </div>
            )}
          </div>

          <div className="animate-fade-in-up delay-200 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{PLATFORM.name}</h3>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
              {PLATFORM.nameLocal} · {PLATFORM.shortName}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{PLATFORM.description}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">Source: {PLATFORM.source}</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {PLATFORM.facts.map((fact) => (
                <div key={fact.label} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{fact.value}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{fact.label}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePostDemand}
              className="w-full mt-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all cursor-pointer shadow-sm"
            >
              Post financing demand (sandbox)
            </button>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 text-center">
              This is a demo. No real request is sent.
            </p>
          </div>
        </div>

        {/* Matched lenders */}
        <div className="animate-fade-in-up delay-250 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Matched lenders</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Sorted from best to worst: who qualifies, who covers the full amount, who's cheapest.
          </p>

          <div className="space-y-2.5">
            {matches.map((match, idx) => {
              const isSelected = match.product.id === selected.product.id;
              const isRequested = requestedProducts.has(match.product.id);
              return (
                <div
                  key={match.product.id}
                  className={`p-4 rounded-2xl border transition-colors ${
                    isSelected
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-slate-200/80 dark:border-slate-800"
                  } ${match.eligible ? "" : "opacity-70"}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {idx === 0 && match.eligible && (
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                            Best fit
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{match.product.name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{match.product.nameLocal}</span>
                        {!match.product.connected && (
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Design only
                          </span>
                        )}
                        {match.eligible ? (
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            Eligible
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                            Not eligible
                          </span>
                        )}
                        {match.fitsCeiling && match.eligible && (
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                            Fits your ceiling
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {match.product.security} · {match.product.termMonths}-month term ·{" "}
                        {REPAYMENT_LABEL[match.product.repaymentType]} · ready in {match.product.speedDays}{" "}
                        day{match.product.speedDays === 1 ? "" : "s"}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {match.product.documents.join(" · ")}
                      </p>
                      {!match.eligible && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                          Missing {match.missing.length}: {match.missing.join(", ")}
                        </p>
                      )}
                      {!match.covers && match.eligible && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                          Only covers {formatMoney(match.cap)} of the {formatMoney(need)} need
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                        {formatPct(match.allIn)}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        all-in a year · {match.product.rateLow}%–{match.product.rateHigh}% base
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        up to {formatMoney(match.cap)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedProductId(match.product.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {isSelected ? "Checking repayment ✓" : "Check repayment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNegotiateProduct(match)}
                      disabled={!match.product.connected || !match.eligible || isRequested}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRequested ? "Sent for approval" : "Negotiate"}
                    </button>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto truncate">
                      {match.product.source}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Repayment check */}
        <div className="animate-fade-in-up delay-300 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Repayment check: {selected.product.name}
            </h3>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {formatMoney(principal)} at {formatPct(selected.allIn)} all-in
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Can you afford each payment?</p>
          <p className="text-sm font-semibold mb-4">
            {shortPayments === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">Yes, every payment is covered</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400">
                {shortPayments} of {repayment.length} payments come up short
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400 font-normal">
              {" "}
              · Lowest cash point: {formatMoney(lowestCashAfterPayment)} (cushion {formatMoney(VITALS.cushion)})
              {totalInterestAndFees !== null && ` · Costs ${formatMoney(totalInterestAndFees)} total`}
            </span>
          </p>

          {/* Repayment chart: cash with vs. without this loan, over the 26-week forecast */}
          {(() => {
            const weeks = repaymentChart.weeks;
            const maxCash = Math.max(...weeks.map((w) => Math.max(w.withoutLoan, w.withLoan)), VITALS.cushion) * 1.05;
            const PAD_X = 12;
            const yFor = (value: number) => CHART_HEIGHT - (value / maxCash) * CHART_HEIGHT;
            const xFor = (idx: number) =>
              PAD_X + (idx * (CHART_LOGICAL_WIDTH - PAD_X * 2)) / Math.max(1, weeks.length - 1);
            const toPath = (values: number[]) =>
              values.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
            const cushionY = yFor(VITALS.cushion);

            return (
              <div className="mb-4">
                <div className="flex gap-3">
                  <div
                    className="flex flex-col justify-between shrink-0 w-14 sm:w-16 text-right"
                    style={{ height: CHART_HEIGHT }}
                  >
                    {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                      <span key={f} className="text-[11px] font-mono text-slate-400 dark:text-slate-500 leading-none">
                        {formatCompactMoney(maxCash * f)}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_LOGICAL_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                        <line
                          key={f}
                          x1={0}
                          x2={CHART_LOGICAL_WIDTH}
                          y1={CHART_HEIGHT - f * CHART_HEIGHT}
                          y2={CHART_HEIGHT - f * CHART_HEIGHT}
                          className="stroke-slate-100 dark:stroke-slate-800"
                          strokeWidth={1}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      <line
                        x1={0}
                        x2={CHART_LOGICAL_WIDTH}
                        y1={cushionY}
                        y2={cushionY}
                        className="stroke-rose-400 dark:stroke-rose-500"
                        strokeWidth={2}
                        strokeDasharray="10 6"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={toPath(weeks.map((w) => w.withoutLoan))}
                        fill="none"
                        className="stroke-slate-300 dark:stroke-slate-600"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={toPath(weeks.map((w) => w.withLoan))}
                        fill="none"
                        className="stroke-blue-500 dark:stroke-blue-400"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {weeks.map((w, i) =>
                        repaymentChart.paymentWeeks.has(w.week) ? (
                          <circle
                            key={w.week}
                            cx={xFor(i)}
                            cy={yFor(w.withLoan)}
                            r={4.5}
                            vectorEffect="non-scaling-stroke"
                            className={w.withLoan >= 0 ? "fill-blue-500 dark:fill-blue-400" : "fill-rose-500 dark:fill-rose-400"}
                          >
                            <title>{`${w.label}: ${formatMoney(w.withLoan)}`}</title>
                          </circle>
                        ) : null
                      )}
                    </svg>
                    <div className="relative mt-1.5" style={{ height: 16 }}>
                      {weeks.map((w, idx) => {
                        if (idx % 2 !== 0) return null;
                        return (
                          <span
                            key={w.week}
                            className="absolute text-[11px] font-mono text-slate-400 dark:text-slate-500 -translate-x-1/2"
                            style={{ left: `${(xFor(idx) / CHART_LOGICAL_WIDTH) * 100}%` }}
                          >
                            {w.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-slate-300 dark:border-slate-600" /> Without this loan
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-full bg-blue-500 dark:bg-blue-400" /> With this loan
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" /> Payment covered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-400" /> Payment short
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-rose-400 dark:border-rose-500" /> Safety cushion
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-2">
            {repayment.map((checkpoint, i) => (
              <div
                key={i}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 flex-wrap ${REPAYMENT_STATUS_STYLE[checkpoint.status]}`}
              >
                <div>
                  <p className="text-sm font-bold">{checkpoint.label}</p>
                  <p className="text-xs opacity-80">
                    {checkpoint.monthsFromNow === 0 ? "Today" : `Month ${checkpoint.monthsFromNow}`} ·{" "}
                    {checkpoint.amount < 0
                      ? `+${formatMoney(-checkpoint.amount)} in`
                      : `${formatMoney(checkpoint.amount)} due`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{checkpoint.status}</p>
                  <p className="text-xs opacity-80">Cash after: {formatMoney(checkpoint.cashAfter)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mandate */}
        <div className="animate-fade-in-up delay-350 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">Your mandate</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            The limits the agent can negotiate within
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">
                Max amount ({COMPANY.currency})
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={mandate.maxAmount}
                onChange={(e) =>
                  setMandate((prev) => ({ ...prev, maxAmount: Number(e.target.value) || 0 }))
                }
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">
                Max all-in rate (% a year)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={mandate.maxRatePct}
                onChange={(e) =>
                  setMandate((prev) => ({ ...prev, maxRatePct: Number(e.target.value) || 0 }))
                }
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">
                Max term (months)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={mandate.maxTermMonths}
                onChange={(e) =>
                  setMandate((prev) => ({ ...prev, maxTermMonths: Number(e.target.value) || 1 }))
                }
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">
            Security allowed
          </label>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {SECURITY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setMandate((prev) => ({
                    ...prev,
                    securityAllowed: { ...prev.securityAllowed, [cat]: !prev.securityAllowed[cat] },
                  }))
                }
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  mandate.securityAllowed[cat]
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4">
            The agent never signs anything. You always give the final yes.
          </p>
        </div>

        {/* Supplier financing pool */}
        <div className="animate-fade-in-up delay-400 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Supplier financing pool</h3>
            <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              Concept, simulated
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            A future idea: group many suppliers' small loans into one bigger, cheaper deal.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-center">
              <p className="text-lg font-black text-slate-900 dark:text-white">{SUPPLIER_POOL.suppliersInPool}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">suppliers in pool</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-center">
              <p className="text-lg font-black text-slate-900 dark:text-white">{SUPPLIER_POOL.sharedAnchorBuyers}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">shared anchor buyers</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-center">
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatMoney(SUPPLIER_POOL.pooledDemand)}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">pooled demand</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-center">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">-{SUPPLIER_POOL.rateCutPct}%</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">rate cut with guarantee</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{SUPPLIER_POOL.description}</p>
        </div>

        {/* Credit package */}
        <div className="animate-fade-in-up delay-450 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">Credit package</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            One click builds the standard file set for {PLATFORM.nameLocal} · {PLATFORM.shortName}
          </p>

          <div className="space-y-1.5">
            {CREDIT_PACKAGE_DOCS.map((doc) => {
              const isAuto = doc.preparedBy === "bizmate";
              const isReady = isAuto || readyDocs.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex-wrap"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{doc.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {doc.nameLocal}
                      {doc.note ? ` · ${doc.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {isAuto ? "BizMate, from your data" : "You"}
                    </span>
                    {isAuto ? (
                      <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                        Auto
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleDoc(doc.id)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          isReady
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {isReady ? "I have it" : "Mark as ready"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
            Once you pick a bank, the agent copies these into that bank's own form.
          </p>

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleBuildPackage}
              className="text-sm font-bold px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-sm"
            >
              Build credit package
            </button>
            <button
              type="button"
              onClick={handleShareWithLender}
              disabled={!packageBuilt}
              className="text-sm font-bold px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Share with lender
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
              {readyCount} of {CREDIT_PACKAGE_DOCS.length} ready
            </span>
          </div>
        </div>

        {/* Green loan check */}
        <div className="animate-fade-in-up delay-500 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Green loan check</h3>
            {GREEN_CHECK.eligibleCandidate && (
              <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                Green Eligible Candidate
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">From the materials you bought in 12 months</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80">
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {GREEN_CHECK.footprintTonnesCO2e.toLocaleString()} t
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">CO2e a year from materials</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80">
              <p className="text-lg font-black text-slate-900 dark:text-white">{footprintPerMillion.toFixed(1)} t</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">per {COMPANY.currency}1M of sales</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Sells 30%+ to EV or clean-energy makers</span>
              <span className={`font-bold ${GREEN_CHECK.evCleanEnergySalesPct >= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                {GREEN_CHECK.evCleanEnergySalesPct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Uses 30%+ recycled metal</span>
              <span className={`font-bold ${GREEN_CHECK.recycledMetalPct >= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                {GREEN_CHECK.recycledMetalPct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5">
              <span className="text-slate-600 dark:text-slate-300">Has a carbon number per unit of sales</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{footprintPerMillion.toFixed(1)} t per {COMPANY.currency}1M</span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-sm text-emerald-800 dark:text-emerald-300">
            {GREEN_CHECK.recommendation}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
            Based on industry averages. This tag flags a candidate; the bank makes the final call.
          </p>
        </div>

        {/* WeBank ecosystem */}
        <div className="animate-fade-in-up delay-500 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">
            Linking into the WeBank ecosystem
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Future ideas for going deeper. None of this is connected yet.
          </p>

          <div className="space-y-2.5">
            {WEBANK_ECOSYSTEM_LINKS.map((link) => (
              <div key={link.id} className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{link.title}</span>
                  {link.titleLocal && <span className="text-xs text-slate-400 dark:text-slate-500">{link.titleLocal}</span>}
                  <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {link.badge}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{link.description}</p>
                {link.source && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Source: {link.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Negotiate drawer */}
      {negotiateProduct && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          onClick={() => setNegotiateProduct(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-5 overflow-y-auto animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Negotiate: {negotiateProduct.product.name}
              </h3>
              <button
                type="button"
                onClick={() => setNegotiateProduct(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const result = negotiate(negotiateProduct.product, COMPANY_PROFILE, mandate.maxRatePct);
              const negotiatedPrincipal = Math.min(need, negotiateProduct.cap);
              const amountOk = negotiatedPrincipal <= mandate.maxAmount;
              const termOk = negotiateProduct.product.termMonths <= mandate.maxTermMonths;
              const securityOk = mandate.securityAllowed[securityCategory(negotiateProduct.product.security)];
              const fullyAcceptable = result.acceptableByAgent && amountOk && termOk && securityOk;
              const reasons: string[] = [];
              if (!result.acceptableByAgent) reasons.push("rate too high");
              if (!amountOk) reasons.push("amount too high");
              if (!termOk) reasons.push("term too long");
              if (!securityOk) reasons.push("security not allowed");

              return (
                <>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 mb-4 text-xs text-slate-600 dark:text-slate-300">
                    A practice negotiation. Your limit: {formatPct(mandate.maxRatePct)} all-in, up to{" "}
                    {formatMoney(mandate.maxAmount)}.
                  </div>

                  <div className="space-y-2.5 mb-4">
                    {[
                      { label: "Your floor", value: result.floor },
                      { label: "Bank asks", value: result.bankAsk },
                      { label: "Agent counters", value: result.counter },
                      { label: "Final rate", value: result.final },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatPct(row.value)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">All-in at final</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatPct(result.final + negotiateProduct.product.feePct)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
                    {fullyAcceptable
                      ? "This fits your limits. You still approve before anything is signed."
                      : `This is outside your limits (${reasons.join(", ")}), so it needs your sign-off.`}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleAskForApproval(negotiateProduct)}
                    className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Ask for approval
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
