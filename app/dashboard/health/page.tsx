"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";

interface HealthScoreFactor {
  name: string;
  score: number;
  weight: number;
  status: "EXCELLENT" | "GOOD" | "ATTENTION";
  evidence: string;
}

interface FinancialSummaryData {
  bankId: string;
  bankName: string;
  company: string;
  referenceDate: string;
  currentCashToday: number;
  formattedCurrentCash: string;
  safetyBuffer: number;
  healthScore: {
    overallScore: number;
    ratingGrade: string;
    creditStatus: string;
    factors: HealthScoreFactor[];
  };
  supplierHistory: {
    name: string;
    supplierId: string;
    totalTransfersCount: number;
    totalOrdersCount: number;
    totalCnySpent: number;
    totalThbSpent: number;
    monthsActive: number;
    verifiedRail: boolean;
  };
  activeBanksCount?: number;
}

interface ActionableFix {
  id: string;
  title: string;
  impactScore: number;
  impactLabel: string;
  category: "HYGIENE" | "COLLECTIONS" | "BUFFER" | "GOVERNANCE";
  description: string;
  actionCta: string;
  actionHref: string;
  isSimulated: boolean;
}

const ACTIONABLE_FIXES: ActionableFix[] = [
  {
    id: "fix-payroll",
    title: "Separate Owner Draw into Dedicated Payroll Schedule",
    impactScore: 5,
    impactLabel: "+5 Points",
    category: "HYGIENE",
    description: "Consistent, scheduled owner salary transfers replace ad-hoc withdrawals, raising debt service coverage & stability score.",
    actionCta: "Review Cash Inflows",
    actionHref: "/dashboard/cash",
    isSimulated: false,
  },
  {
    id: "fix-ar-recovery",
    title: "Settle Overdue Buyer Receivables (< 14 Days)",
    impactScore: 6,
    impactLabel: "+6 Points",
    category: "COLLECTIONS",
    description: "Dispatch polite LINE OA courtesy reminders to overdue debtors to lift the Debtor Regularity score from Attention to Excellent.",
    actionCta: "Open Collections Ledger",
    actionHref: "/dashboard/collections",
    isSimulated: false,
  },
  {
    id: "fix-buffer",
    title: "Preserve 100% of 13-Week Operating Safety Buffer",
    impactScore: 4,
    impactLabel: "+4 Points",
    category: "BUFFER",
    description: "Defer large trade payables to 60 days to prevent rolling liquidity dips below the required safety threshold.",
    actionCta: "Explore 60-Day Terms",
    actionHref: "/dashboard/funding",
    isSimulated: false,
  },
  {
    id: "fix-verified-rail",
    title: "Enforce Verified Rail on All High-Value Supplier Payments",
    impactScore: 3,
    impactLabel: "+3 Points",
    category: "GOVERNANCE",
    description: "Route foreign transactions through verified trade registries, locking out unvetted Gray Market or spoofed accounts.",
    actionCta: "Check Risk Shield",
    actionHref: "/dashboard/true-cost",
    isSimulated: false,
  },
];

export default function HealthAgentHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("kbank");
  const [isBankConnected, setIsBankConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summaryData, setSummaryData] = useState<FinancialSummaryData | null>(null);

  // Simulation state for Actionable Fixes
  const [simulatedFixIds, setSimulatedFixIds] = useState<string[]>([]);
  const [simulatedToast, setSimulatedToast] = useState<string | null>(null);

  // Business Passport Preview Bottom Sheet
  const [isPassportOpen, setIsPassportOpen] = useState<boolean>(false);
  const [passportConsentGiven, setPassportConsentGiven] = useState<boolean>(false);
  const [passportToast, setPassportToast] = useState<string | null>(null);

  // Factor Detail Inspection
  const [selectedFactor, setSelectedFactor] = useState<HealthScoreFactor | null>(null);

  // Bank sync and session verification
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);

    const syncBankState = () => {
      if (typeof window !== "undefined") {
        const storedBankState = localStorage.getItem("bizmate_bank_connected");
        const storedBankChoice = localStorage.getItem("bizmate_selected_bank") || "kbank";
        setSelectedBankId(storedBankChoice);

        if (storedBankState === "true") {
          setIsBankConnected(true);
          fetchSummary(storedBankChoice);
        } else if (storedBankState === "false") {
          setIsBankConnected(false);
          setIsLoading(false);
        } else {
          setIsBankConnected(true);
          fetchSummary(storedBankChoice);
        }
      }
    };

    syncBankState();
    window.addEventListener("bizmate_bank_changed", syncBankState);
    return () => {
      window.removeEventListener("bizmate_bank_changed", syncBankState);
    };
  }, [router]);

  const fetchSummary = async (bankId: string) => {
    setIsLoading(true);
    try {
      let enabledIds: string[] = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("bizmate_enabled_banks");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) enabledIds = parsed;
          }
        } catch {}
      }

      const query = enabledIds.length > 0 ? `bankIds=${enabledIds.join(",")}` : `bankId=${bankId}`;
      const res = await fetch(`/api/financial/summary?${query}`);
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Failed to fetch health score telemetry:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchBank = (bankId: string) => {
    setSelectedBankId(bankId);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_selected_bank", bankId);
      window.dispatchEvent(new Event("bizmate_bank_changed"));
    }
  };

  // Toggle Actionable Fix Simulation
  const handleToggleFix = (fixId: string) => {
    setSimulatedFixIds((prev) => {
      const exists = prev.includes(fixId);
      const next = exists ? prev.filter((id) => id !== fixId) : [...prev, fixId];
      const targetFix = ACTIONABLE_FIXES.find((f) => f.id === fixId);
      if (!exists && targetFix) {
        setSimulatedToast(`Simulated fix "${targetFix.title}" (+${targetFix.impactScore} pts) applied!`);
      } else if (exists && targetFix) {
        setSimulatedToast(`Removed simulation for "${targetFix.title}".`);
      }
      setTimeout(() => setSimulatedToast(null), 3500);
      return next;
    });
  };

  // Baseline score calculation with simulated improvements
  const baseScore = summaryData?.healthScore?.overallScore || 78;
  const simulatedBonus = simulatedFixIds.reduce((sum, id) => {
    const item = ACTIONABLE_FIXES.find((f) => f.id === id);
    return sum + (item ? item.impactScore : 0);
  }, 0);
  const effectiveScore = Math.min(100, baseScore + simulatedBonus);

  // Grade badge & credit tier calculation
  const getRatingInfo = (score: number) => {
    if (score >= 90) return { grade: "Grade A+", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800", tier: "Tier 1 Top Prime", interestNote: "Lowest commercial borrowing rates (6.5% - 8.0% APR)" };
    if (score >= 80) return { grade: "Grade A", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800", tier: "Prime SME Tier", interestNote: "Pre-approved clean credit line up to ฿2,000,000" };
    if (score >= 70) return { grade: "Grade B+", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800", tier: "Prime Credit Line Eligible", interestNote: "Standard working capital rates (8.5% - 10.5% APR)" };
    if (score >= 60) return { grade: "Grade B", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800", tier: "Qualifying Standard Tier", interestNote: "Collateral or trade transaction guarantee recommended" };
    return { grade: "Grade C", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800", tier: "Hygiene Remediation Needed", interestNote: "Focus on zero-overdraft and customer collections first" };
  };

  const ratingInfo = getRatingInfo(effectiveScore);

  // Circumference for SVG ring
  const circleRadius = 58;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (effectiveScore / 100) * circleCircumference;

  // Handle Business Passport Consent
  const handleAuthorizePassportShare = () => {
    setPassportConsentGiven(true);
    setPassportToast("Certified Business Passport ready. Zero-Surprise Guardrail: No external institution will receive your dossier without explicit approval per lender.");
    setTimeout(() => setPassportToast(null), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16 transition-colors">
      <AppHeader user={user} activeNav="dashboard" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Top Breadcrumb & Bank Account Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              Health Agent &amp; Credit Hygiene
            </span>
          </div>

          {/* Connected Bank Switcher */}
          {isBankConnected && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
                Telemetry Source:
              </span>
              <select
                value={selectedBankId}
                onChange={(e) => handleSwitchBank(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer shadow-xs"
              >
                <option value="kbank">KBANK: Ploy Select Operating (Shenzhen Chen Tech)</option>
                <option value="scb">SCB: Apex Craft Corporate (Osaka Timber)</option>
                <option value="bbl">BBL: BioHarvest Agro Tech (Heilongjiang)</option>
                <option value="personal">Personal Savings: Freelance Creator (Domestic)</option>
              </select>
            </div>
          )}
        </div>

        {/* LOCKED STATE WHEN BANK IS NOT LINKED */}
        {!isBankConnected ? (
          <div className="rounded-3xl p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center max-w-2xl mx-auto my-12 animate-fade-in-up">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              🔒
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-block mb-3">
              Bank Connection Required
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Health Agent &amp; Credit Readiness Locked
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-md mx-auto">
              To evaluate your 7-factor financial hygiene score, unlock lender credit readiness tiers, and simulate score improvement ROI, please connect or select an operating bank account first.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>← Back to Dashboard to Connect Bank</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Notification Toasts */}
            {simulatedToast && (
              <div className="mb-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>📈</span>
                  <span>{simulatedToast}</span>
                </div>
                <button
                  onClick={() => setSimulatedToast(null)}
                  className="text-blue-600 dark:text-blue-400 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {passportToast && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>🛡️</span>
                  <span>{passportToast}</span>
                </div>
                <button
                  onClick={() => setPassportToast(null)}
                  className="text-emerald-600 dark:text-emerald-400 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Standard Agent Header Component (shared/AgentHeader compliant) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {/* Animated agent avatar */}
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold animate-bounce shadow-xs">
                      🩺
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                          Health Agent
                        </h1>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          {ratingInfo.grade}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        7-Factor Credit Hygiene &amp; Lender Readiness Telemetry
                      </p>
                    </div>
                  </div>

                  {/* Speech Bubble Context - Friendly & Crisp */}
                  <div className="mt-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
                    <span className="text-base shrink-0">💬</span>
                    <div>
                      <span>Health score is at <strong>{effectiveScore}/100</strong> ({ratingInfo.grade}).</span>{" "}
                      <span className="text-slate-600 dark:text-slate-300">
                        {ratingInfo.tier} • {ratingInfo.interestNote}
                      </span>
                    </div>
                  </div>

                  {/* Operational Boundaries */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span><strong>Auto:</strong> Monitors transaction hygiene &amp; calculates 7 factors</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span><strong>Consent Trigger:</strong> Asks before sharing Business Passport</span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Pill: Business Passport Button */}
                <div className="flex flex-col gap-2 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 min-w-[220px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] text-slate-400 font-medium">Lender Readiness</span>
                    <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                      {ratingInfo.tier}
                    </span>
                  </div>
                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700" />
                  <button
                    type="button"
                    onClick={() => setIsPassportOpen(true)}
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>📄</span>
                    <span>View Business Passport</span>
                  </button>
                </div>
              </div>

              {/* Data Lineage Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  Uses {summaryData?.bankName || "Linked Statement Feed"} • Updated Monday 09:41 AM ICT
                </span>
                <span>Deterministic Hygiene Engine</span>
              </div>
            </div>

            {/* Score Ring Component & Overview Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Score Ring Visual Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="relative w-40 h-40 flex items-center justify-center my-2">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                    <circle
                      cx="70"
                      cy="70"
                      r={circleRadius}
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-slate-100 dark:text-slate-800"
                      fill="transparent"
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={circleRadius}
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="text-blue-600 dark:text-blue-400 transition-all duration-700"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {effectiveScore}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 font-semibold">/ 100</span>
                    <span className={`text-[11px] font-bold mt-0.5 px-2 py-0.5 rounded-full ${ratingInfo.bg} ${ratingInfo.color}`}>
                      {ratingInfo.grade}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {summaryData?.company || "Operating SME Entity"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {simulatedBonus > 0 ? (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        Base {baseScore} pts + {simulatedBonus} simulated pts
                      </span>
                    ) : (
                      "Evaluated across 7 financial hygiene pillars"
                    )}
                  </p>
                </div>

                {/* Eligibility Tier Indicator Pill */}
                <div className="mt-4 w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-left">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Clean Credit Line:</span>
                    <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                      {effectiveScore >= 75 ? "฿1,500,000 - ฿2,000,000" : "฿500,000 - ฿800,000"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Est. Rate:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {effectiveScore >= 80 ? "8.5% - 9.5% APR" : "10.5% - 12.0% APR"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 7-Factor Breakdown List */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>7-Pillar Financial Hygiene Breakdown</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Weighted Deterministic
                      </span>
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">Live Telemetry</span>
                  </div>

                  <div className="space-y-3">
                    {(summaryData?.healthScore?.factors || []).map((factor, idx) => {
                      const isGood = factor.score >= 80;
                      const isAttention = factor.score < 70;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedFactor(factor)}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {factor.name}
                              </span>
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                                  isGood
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                    : isAttention
                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                    : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {factor.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {factor.evidence}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="w-20 hidden sm:block">
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isGood
                                      ? "bg-emerald-500"
                                      : isAttention
                                      ? "bg-amber-500"
                                      : "bg-blue-500"
                                  }`}
                                  style={{ width: `${factor.score}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white w-10 text-right">
                              {factor.score}/100
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Weight: 15% each (hygiene, DTI, trade, channels, AR, buffer) • 10% risk defense</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer">Click factor for details →</span>
                </div>
              </div>
            </div>

            {/* Actionable Fixes & Simulated ROI */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Actionable Improvements &amp; Simulated ROI</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                      Interactive Simulation
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Toggle practical operational steps to simulate their direct impact on credit tier qualification.
                  </p>
                </div>

                {simulatedFixIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedFixIds([]);
                      setSimulatedToast("Cleared all simulated improvements.");
                      setTimeout(() => setSimulatedToast(null), 3000);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    Reset Simulation
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ACTIONABLE_FIXES.map((fix) => {
                  const isApplied = simulatedFixIds.includes(fix.id);
                  return (
                    <div
                      key={fix.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isApplied
                          ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              {fix.impactLabel}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {fix.category}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {fix.title}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFix(fix.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isApplied
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {isApplied ? "Simulated ✓" : "Simulate +"}
                        </button>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                        {fix.description}
                      </p>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-400">Implementation Rail</span>
                        <Link
                          href={fix.actionHref}
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{fix.actionCta}</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Business Passport Preview Bottom Sheet (Modal) */}
      {isPassportOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold">
                  📄
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Certified Business Passport (Lender Dossier)</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Redacted
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pre-cleared credit document for institutional lenders
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPassportOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Redacted Lender Dossier Contents */}
            <div className="space-y-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Entity Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-sans">
                    {summaryData?.company || "Ploy Select Co., Ltd."}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Operating Institution:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {summaryData?.bankName || "Kasikornbank"} (Account: •••• 9081)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Audited Score:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {effectiveScore} / 100 ({ratingInfo.grade}) • {ratingInfo.tier}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Zero-Overdraft Track Record:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    0 Incidents Across 365 Days
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Verified Cross-Border Supplier:</span>
                  <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">
                    {summaryData?.supplierHistory?.name || "Verified Trade Counterparty"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Trade History Duration:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {summaryData?.supplierHistory?.monthsActive || 12} Months Active ({summaryData?.supplierHistory?.totalTransfersCount || 14} Settlements)
                  </span>
                </div>
              </div>

              {/* Data Privacy & Consent Disclosure */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-slate-700 dark:text-slate-300 font-sans text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-200">
                  <span>🛡️</span>
                  <span>Trust Agent &amp; PDPA Compliance Notice</span>
                </div>
                <p className="leading-relaxed">
                  Your raw bank statements remain completely confidential and encrypted under Thailand PDPA B.E. 2562. No external bank, fintech, or lender receives your full transactional history without your explicit sign-off in the Central Inbox.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPassportOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAuthorizePassportShare();
                  setIsPassportOpen(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{passportConsentGiven ? "✓ Ready for Lender Application" : "Authorize Business Passport"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factor Detail Bottom Sheet (Modal) */}
      {selectedFactor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🩺</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedFactor.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFactor(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pillar Score:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                  {selectedFactor.score} / 100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Evaluation Status:</span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {selectedFactor.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Health Weight:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {Math.round(selectedFactor.weight * 100)}% of overall rating
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 font-mono text-[10px] uppercase block mb-1">
                  Ledger Evidence
                </span>
                <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                  {selectedFactor.evidence}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedFactor(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
