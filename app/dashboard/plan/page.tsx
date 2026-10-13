"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { getSession, AuthUser } from "@/lib/auth-client";

interface DeliberationStep {
  id: string;
  stepNumber: number;
  agentId: "cash" | "collections" | "funding" | "true-cost" | "trust";
  agentName: string;
  agentEmoji: string;
  agentRole: string;
  agentColor: string;
  badge: string;
  title: string;
  timestamp: string;
  summary: string;
  reasoning: string;
  dataPoints: Array<{ label: string; value: string }>;
  outcomeBadge: string;
  outcomeType: "warning" | "success" | "info" | "shield";
}

const DELIBERATION_STEPS: DeliberationStep[] = [
  {
    id: "step-1-cash",
    stepNumber: 1,
    agentId: "cash",
    agentName: "Cash Agent",
    agentEmoji: "📊",
    agentRole: "13-Week Cash Radar",
    agentColor: "#0284C7",
    badge: "Liquidity Alert",
    title: "Detection of Critical 26 Oct Cash Dip",
    timestamp: "12 Oct 2026, 09:41 AM ICT",
    summary:
      "Ingested multi-channel sales forecasts and scheduled outflows. Projected Week 3 liquidity plunging below the ฿80,000 threshold upon Chen Tech payment.",
    reasoning:
      "On 26 October 2026, the scheduled purchase order payment to Shenzhen Chen Tech (¥100,000 ≈ ฿482,500) will plunge operating balance down to ฿64,000.00. This triggers a ฿16,000.00 deficit below our ฿80,000.00 safety buffer. An autonomous multi-agent advisory ticket was instantly dispatched to protect business liquidity.",
    dataPoints: [
      { label: "Target Date", value: "26 Oct 2026" },
      { label: "Scheduled Outflow", value: "¥100,000 (฿482,500)" },
      { label: "Predicted Balance", value: "฿64,000.00" },
      { label: "Safety Buffer Deficit", value: "-฿16,000.00 (Breached)" },
    ],
    outcomeBadge: "Shortfall Quantified: -฿16,000",
    outcomeType: "warning",
  },
  {
    id: "step-2-collections",
    stepNumber: 2,
    agentId: "collections",
    agentName: "Collections Agent",
    agentEmoji: "🔔",
    agentRole: "Smart AR Follow-ups",
    agentColor: "#F97316",
    badge: "Internal AR Audit",
    title: "Surfacing Overdue Receivables to Accelerate Inflow",
    timestamp: "12 Oct 2026, 09:41 AM ICT",
    summary:
      "Scanned accounts receivable ledger. Identified overdue invoice from Boutique Siam and prepared polite LINE reminder.",
    reasoning:
      "Before seeking high-cost external financing, internal receivables should be recovered. Boutique Siam owes ฿35,000.00 on Invoice #BS-8820 (due 21 September, currently 21.4 days overdue). Buyer profiling indicates Boutique Siam always settles when reminded gently. Formulated polite LINE reminder scheduled for dispatch to recover ฿35,000 before 20 October.",
    dataPoints: [
      { label: "Debtor", value: "Boutique Siam Co., Ltd." },
      { label: "Overdue Invoice", value: "฿35,000.00 (#BS-8820)" },
      { label: "Days Delinquent", value: "21.4 Days Overdue" },
      { label: "Projected Inflow Date", value: "20 Oct 2026 (+฿35,000)" },
    ],
    outcomeBadge: "Internal Liquidity Unlocked: +฿35,000",
    outcomeType: "success",
  },
  {
    id: "step-3-funding",
    stepNumber: 3,
    agentId: "funding",
    agentName: "Funding Agent",
    agentEmoji: "💰",
    agentRole: "Working Capital & Terms",
    agentColor: "#EAB308",
    badge: "Terms Negotiation",
    title: "Evaluating 6 Capital Options & Drafting 60-Day Terms",
    timestamp: "12 Oct 2026, 09:42 AM ICT",
    summary:
      "Evaluated 6 financing routes. Selected 60-day deferred supplier terms at 1.1% fee with Mr. Chen as the lowest-cost capital strategy.",
    reasoning:
      "Examined six capital sources: supplier deferral, bank working capital, invoice factoring, line of credit, micro-loan, and external private credit. Because Ploy Select has 12 months of certified trade history with Shenzhen Chen Tech (5 historical bi-monthly transfers totaling ¥261,000), Chen Tech's export credit partner offers 60-day deferred payment for a 1.1% fee (~฿5,307). This defers the ¥100k outflow to 25 December, preserving 100% of the safety buffer without taking on long-term debt.",
    dataPoints: [
      { label: "Selected Structure", value: "60-Day Supplier Deferral" },
      { label: "Financing Fee", value: "1.1% (~฿5,307.50)" },
      { label: "Deferred Due Date", value: "25 Dec 2026" },
      { label: "Backup Facility", value: "Krungthai 'Sip Muen' (9.5% APR)" },
    ],
    outcomeBadge: "Lowest Total Cost: 1.1% Fee",
    outcomeType: "info",
  },
  {
    id: "step-4-true-cost",
    stepNumber: 4,
    agentId: "true-cost",
    agentName: "True Cost Agent",
    agentEmoji: "🔍",
    agentRole: "APR & Fraud Shield",
    agentColor: "#EF4444",
    badge: "Scam & APR Defense",
    title: "Unpacking Hidden Fees & Rejecting Predatory Solicitations",
    timestamp: "12 Oct 2026, 09:42 AM ICT",
    summary:
      "Calculated true effective APR across all alternatives. Rejected a 1%/day predatory ad and locked payment to verified CCB rail.",
    reasoning:
      "Conducted statutory APR analysis on evaluated financing options. Flagged an external 'Fast Cash, 1% per day' advertisement as predatory: 1% daily compounded equals 365.0% annual APR, far exceeding the Bank of Thailand's 15% statutory ceiling. Simultaneously verified Chen Tech's China Construction Bank (CCB) account against the official trade registry to guarantee zero Vendor Email Compromise (VEC).",
    dataPoints: [
      { label: "Predatory Trap Flagged", value: "'1% a Day' Loan (365% APR)" },
      { label: "Regulatory Ceiling", value: "15.0% per annum (BOT)" },
      { label: "Verified Rail", value: "China Construction Bank (CCB)" },
      { label: "Fraud Intercept Status", value: "100% Verified Registry" },
    ],
    outcomeBadge: "Predatory Traps Blocked: 0% APR Scams",
    outcomeType: "shield",
  },
  {
    id: "step-5-trust",
    stepNumber: 5,
    agentId: "trust",
    agentName: "Trust Agent",
    agentEmoji: "🛡️",
    agentRole: "Security Gatekeeper",
    agentColor: "#6366F1",
    badge: "Zero-Surprise Guardrail",
    title: "Synthesizing Plan into 3 User Approvals with Face ID Lock",
    timestamp: "12 Oct 2026, 09:43 AM ICT",
    summary:
      "Enforced Zero-Surprise policy. Generated 3 non-destructive approval cards in Central Inbox and enforced Biometric Face ID on FX transfer.",
    reasoning:
      "Under our deterministic safety axioms, no automated communication or fund transfer occurs without explicit owner approval. Structured the joint strategy into exactly three actionable approval items in Central Inbox: (1) Review polite reminder to Boutique Siam, (2) Review bilingual 60-day terms proposal to Mr. Chen, and (3) Authorize verified CCB FX rail payment with biometric Face ID step-up verification.",
    dataPoints: [
      { label: "Zero-Surprise Policy", value: "Enforced (0 Silent Debits)" },
      { label: "Pending Approvals", value: "3 Items in Central Inbox" },
      { label: "Biometric Step-Up", value: "Face ID Required for FX" },
      { label: "Audit Ledger", value: "Recorded with SHA-256 Hash" },
    ],
    outcomeBadge: "Protected by Biometric Step-Up",
    outcomeType: "shield",
  },
];

interface OptionComparison {
  id: string;
  title: string;
  type: "RECOMMENDED" | "BACKUP" | "PARTIAL" | "REJECTED_PREDATORY" | "REJECTED_UNLICENSED";
  costLabel: string;
  effectiveApr: string;
  liquidityImpact: string;
  speed: string;
  evaluationVerdict: string;
  badgeText: string;
  badgeColor: string;
  leadAgents: string[];
}

const COMPARISON_OPTIONS: OptionComparison[] = [
  {
    id: "opt-1-supplier",
    title: "60-Day Supplier Terms (Shenzhen Chen Tech)",
    type: "RECOMMENDED",
    costLabel: "1.1% one-time financing fee (~฿5,307)",
    effectiveApr: "6.6% annualized APR equivalent",
    liquidityImpact: "Preserves 100% of ฿80k buffer; defers ¥100k outflow to 25 Dec",
    speed: "Same-day via WeChat / Email negotiation",
    evaluationVerdict:
      "Optimal solution. Leverages 12-month verified trade history. Generates 60 days of runway with zero collateral and minimal fee.",
    badgeText: "Recommended (Rank 1)",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    leadAgents: ["Funding Agent", "True Cost Agent"],
  },
  {
    id: "opt-2-krungthai",
    title: "Krungthai 'Sip Muen' SME Working Capital Loan",
    type: "BACKUP",
    costLabel: "9.5% APR interest (~฿4,750 over 12 mo)",
    effectiveApr: "9.5% APR per annum",
    liquidityImpact: "Injects ฿100,000 credit line; monthly repayment ฿8,750",
    speed: "1-2 business days with Business Passport",
    evaluationVerdict:
      "Strong fallback strategy. Ploy Select qualifies automatically with Grade B+ (78 Health Score). Held on standby if supplier terms are declined.",
    badgeText: "Evaluated Backup (Rank 2)",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800",
    leadAgents: ["Funding Agent", "Health Agent"],
  },
  {
    id: "opt-3-factoring",
    title: "Invoice Factoring on Boutique Siam (AR Advance)",
    type: "PARTIAL",
    costLabel: "2.5% factoring fee (฿875 on ฿35,000)",
    effectiveApr: "15.0% APR equivalent",
    liquidityImpact: "Provides immediate ฿28,000 (80% advance on invoice)",
    speed: "4 hours approval",
    evaluationVerdict:
      "Viable partial solution, but ฿28,000 advance does not cover the full ฿482k Chen Tech invoice alone. Direct AR recovery prioritized first.",
    badgeText: "Evaluated Partial (Rank 3)",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    leadAgents: ["Funding Agent", "Collections Agent"],
  },
  {
    id: "opt-4-predatory",
    title: "'Fast Cash 1% a Day' Online Loan Ad",
    type: "REJECTED_PREDATORY",
    costLabel: "Advertised: 'Only 1% per day'",
    effectiveApr: "365.0% Compounded Annual APR",
    liquidityImpact: "Debt trap risk: ฿100,000 loan accrues ฿30,000 fee in 30 days",
    speed: "Instant disbursement",
    evaluationVerdict:
      "HARD-REJECTED. True Cost Agent detected 365% effective APR, which breaches the Bank of Thailand's 15% statutory lending ceiling by 24x.",
    badgeText: "REJECTED - PREDATORY TRAP",
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800",
    leadAgents: ["True Cost Agent"],
  },
  {
    id: "opt-5-unlicensed",
    title: "Unlicensed Hong Kong Offshore FX Broker",
    type: "REJECTED_UNLICENSED",
    costLabel: "Promised 0.2% tighter exchange spread",
    effectiveApr: "N/A (Unlicensed third-party intermediary)",
    liquidityImpact: "High capital risk: unverified escrow account",
    speed: "Immediate wire",
    evaluationVerdict:
      "HARD-REJECTED. Trust Agent verified payment details and flagged an unverified personal bank intermediary matching phishing patterns.",
    badgeText: "REJECTED - SECURITY RISK",
    badgeColor: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    leadAgents: ["Trust Agent"],
  },
];

export default function CollaborativePlanPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"trace" | "comparison" | "actions">("trace");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
  }, [router]);

  const filteredSteps =
    selectedAgentFilter === "ALL"
      ? DELIBERATION_STEPS
      : DELIBERATION_STEPS.filter((s) => s.agentId === selectedAgentFilter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <span>←</span>
              <span>Dashboard</span>
            </Link>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            <Link href="/" className="hidden sm:inline-flex items-center gap-2">
              <span
                style={{ fontFamily: "var(--font-logo)" }}
                className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent"
              >
                BizMate
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex text-[11px] font-mono px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-semibold items-center gap-1.5">
              <span>⚡</span>
              <span>Explainable AI Engine (Glass Box)</span>
            </span>

            <ThemeToggle />

            <UserProfileMenu
              user={user}
              onLogout={() => {
                router.push("/");
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        {/* Breadcrumb & Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2 font-mono">
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">The Agents&apos; Collaborative Plan</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                The Agents&apos; Collaborative Plan
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
                Transparent multi-agent deliberation trace showing how your 6 financial agents synchronized to resolve the 26 Oct liquidity dip while preserving your ฿80,000 safety buffer.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              <Link
                href="/dashboard#inbox-approvals"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>📬</span>
                <span>Open Approval Inbox (3)</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================
            HERO SUMMARY CARD: THE CORE CONFLICT & SYNCHRONIZED SOLUTION
        ======================================================== */}
        <section className="mb-8">
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl border border-blue-800/60 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-xs font-mono font-bold mb-3">
                  <span>⚠️</span>
                  <span>Conflict Resolution: 26 Oct Liquidity Deficit</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Preserving ฿80k Safety Buffer with Zero Predatory Debt
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                  Scheduled payment of <strong>¥100,000 (~฿482,500)</strong> to Shenzhen Chen Tech on 26 October would plunge cash down to <strong>฿64,000</strong> (-฿16,000 buffer breach). Rather than taking high-interest loans, your agents negotiated terms and accelerated overdue collections.
                </p>
              </div>

              {/* Side-by-side Impact Metrics */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0 bg-white/10 dark:bg-black/30 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/10">
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-center">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300">
                    Without Plan (26 Oct)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-rose-400 mt-1">
                    ฿64,000
                  </div>
                  <div className="text-[10px] text-rose-200 mt-0.5">
                    ❌ ฿16,000 Buffer Breach
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                    With Plan (26 Oct)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
                    ฿115,000+
                  </div>
                  <div className="text-[10px] text-emerald-200 mt-0.5">
                    ✅ Safety Buffer Protected
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 3 Quick Actions Summary */}
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-orange-500/30 text-orange-300 flex items-center justify-center font-bold">1</span>
                <span><strong>Recover ฿35k AR:</strong> Boutique Siam invoice</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-yellow-500/30 text-yellow-300 flex items-center justify-center font-bold">2</span>
                <span><strong>60-Day Terms:</strong> Defer ¥100k at 1.1% fee</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold">3</span>
                <span><strong>Biometric Lock:</strong> Face ID on FX rail</span>
              </div>
            </div>
          </div>
        </section>

        {/* View Tabs Selector */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("trace")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "trace"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <span>🔬 Multi-Agent Deliberation Trace</span>
            </button>
            <button
              onClick={() => setActiveTab("comparison")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "comparison"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <span>⚖️ Recommended vs. Evaluated Alternatives (6)</span>
            </button>
            <button
              onClick={() => setActiveTab("actions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "actions"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <span>📬 Actionable Steps (3 Approvals)</span>
            </button>
          </div>

          <span className="hidden sm:inline-block text-[11px] font-mono text-slate-500">
            Axiom 1: Glass Box Reasoning
          </span>
        </div>

        {/* TAB 1: THE MULTI-AGENT DELIBERATION TRACE */}
        {activeTab === "trace" && (
          <section className="space-y-6 animate-fade-in-up">
            {/* Filter by agent */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Filter by Agent:</span>
              {[
                { id: "ALL", label: "All Agents (5 Steps)" },
                { id: "cash", label: "📊 Cash Agent" },
                { id: "collections", label: "🔔 Collections Agent" },
                { id: "funding", label: "💰 Funding Agent" },
                { id: "true-cost", label: "🔍 True Cost Agent" },
                { id: "trust", label: "🛡️ Trust Agent" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setSelectedAgentFilter(btn.id)}
                  className={`px-3 py-1.5 rounded-xl border font-semibold text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    selectedAgentFilter === btn.id
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Deliberation Chain Cards */}
            <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
              {filteredSteps.map((step) => {
                return (
                  <div
                    key={step.id}
                    className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow group"
                  >
                    {/* Step marker node */}
                    <div
                      className="absolute -left-[37px] sm:-left-[45px] top-6 w-8 h-8 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center text-sm shadow-md"
                      style={{ backgroundColor: step.agentColor }}
                    >
                      <span className="text-white font-bold">{step.stepNumber}</span>
                    </div>

                    {/* Step Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-xs"
                          style={{ backgroundColor: `${step.agentColor}18` }}
                        >
                          {step.agentEmoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {step.agentName}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {step.agentRole}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {step.timestamp}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-xl self-start sm:self-center ${
                          step.outcomeType === "warning"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : step.outcomeType === "success"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : step.outcomeType === "shield"
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                        }`}
                      >
                        {step.badge}
                      </span>
                    </div>

                    {/* Title & Core Summary */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      {step.summary}
                    </p>

                    {/* Deep Reasoning Box (Glass Box Insight) */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs">💡</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          Glass-Box Deliberation Rationale:
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                        {step.reasoning}
                      </p>
                    </div>

                    {/* Evidence & Data Points */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {step.dataPoints.map((dp, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="text-[10px] font-mono uppercase text-slate-400">
                            {dp.label}
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                            {dp.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Step Result Outcome Tag */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        Status: Synced with Agent Team
                      </span>
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {step.outcomeBadge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 2: COMPARISON OF EVALUATED ALTERNATIVES */}
        {activeTab === "comparison" && (
          <section className="space-y-6 animate-fade-in-up">
            <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
              <span className="text-lg">⚖️</span>
              <div>
                <h4 className="font-bold">Total Cost of Capital &amp; Risk Ranking</h4>
                <p className="mt-0.5 leading-relaxed text-blue-800 dark:text-blue-300">
                  The Funding Agent and True Cost Agent evaluated 6 capital paths. All proposals were evaluated against effective APR, regulatory compliance (15% BOT ceiling), and counterparty verification before presenting the recommended strategy.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPARISON_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-300 ${
                    opt.type === "RECOMMENDED"
                      ? "border-2 border-emerald-500 shadow-md ring-1 ring-emerald-500/30"
                      : opt.type.startsWith("REJECTED")
                      ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border ${opt.badgeColor}`}
                    >
                      {opt.badgeText}
                    </span>
                    <div className="flex items-center gap-1">
                      {opt.leadAgents.map((ag, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          {ag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    {opt.title}
                  </h3>

                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">Total Capital Cost:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{opt.costLabel}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">Effective Annual APR:</span>
                      <span
                        className={`font-mono font-bold ${
                          opt.type === "REJECTED_PREDATORY"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {opt.effectiveApr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">Liquidity Impact:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[220px]">
                        {opt.liquidityImpact}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    <strong>Verdict:</strong> {opt.evaluationVerdict}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: THE 3 ACTIONABLE APPROVAL ITEMS */}
        {activeTab === "actions" && (
          <section className="space-y-6 animate-fade-in-up">
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <h4 className="font-bold">Zero-Surprise Policy: 3 Decisions Awaiting Owner OK</h4>
                <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                  Autonomous agents have formulated this complete strategy, but cannot execute any external communication or money transfer without your explicit confirmation in Central Inbox.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-800">
                      Step 1 • Collections
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +฿35,000 Inflow
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Send Overdue Reminder to Boutique Siam
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Polite reminder via official LINE for ฿35,000 (Invoice #BS-8820, 21.4 days overdue). Targets recovery by 20 Oct.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">Trust Checked ✅</span>
                  <Link
                    href="/dashboard#inbox-approvals"
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Review Draft →
                  </Link>
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/60 px-2.5 py-1 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      Step 2 • Funding
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      Saves ฿80k Buffer
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Request 60-Day Terms from Shenzhen Chen Tech
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Bilingual terms proposal (Simplified Chinese &amp; English) to defer ¥100k to 25 Dec at 1.1% fee financing.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">Export Credit Pre-cleared</span>
                  <Link
                    href="/dashboard#inbox-approvals"
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Inspect Terms →
                  </Link>
                </div>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      Step 3 • True Cost &amp; Trust
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      Biometric Protected
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Authorize Verified Partner FX Rail
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Lock payment to China Construction Bank registry account. Mandatory Face ID biometric verification required.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">Face ID Step-Up 🛡️</span>
                  <Link
                    href="/dashboard#inbox-approvals"
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Authorize →
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold">Ready to sign off on the collaborative plan?</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visit Central Inbox to approve individual items with one tap.
                </p>
              </div>
              <Link
                href="/dashboard#inbox-approvals"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shrink-0"
              >
                Go to Central Approval Inbox
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
