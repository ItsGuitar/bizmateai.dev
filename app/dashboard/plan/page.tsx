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
  title: string;
  actionSummary: string;
  keyMetric: string;
  metricType: "warning" | "success" | "info" | "shield";
  detailedReasoning: string;
  dataPoints: Array<{ label: string; value: string }>;
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
    title: "Flagged 26 Oct Liquidity Deficit",
    actionSummary: "Projected ¥100k (฿482.5k) Chen Tech order plunges balance to ฿64,000, breaching ฿80,000 buffer.",
    keyMetric: "฿16,000 Deficit",
    metricType: "warning",
    detailedReasoning:
      "On 26 Oct 2026, paying Shenzhen Chen Tech ¥100,000 leaves only ฿64,000 operating cash. This triggers an automated collaborative alert across all 6 agents to protect liquidity without expensive emergency loans.",
    dataPoints: [
      { label: "Target Date", value: "26 Oct 2026" },
      { label: "Outflow", value: "¥100,000 (฿482,500)" },
      { label: "Projected Balance", value: "฿64,000" },
      { label: "Safety Threshold", value: "฿80,000" },
    ],
  },
  {
    id: "step-2-collections",
    stepNumber: 2,
    agentId: "collections",
    agentName: "Collections Agent",
    agentEmoji: "🔔",
    agentRole: "Smart AR Follow-ups",
    agentColor: "#F97316",
    title: "Accelerated Boutique Siam AR Recovery",
    actionSummary: "Audited debtor ledger and surfaced ฿35,000 overdue invoice. Drafted courteous LINE reminder for 20 Oct.",
    keyMetric: "+฿35,000 Inflow",
    metricType: "success",
    detailedReasoning:
      "Boutique Siam owes ฿35,000 on Invoice #BS-8820 (21.4 days overdue). Payment habit analysis shows they pay promptly when reminded. Unlocking internal receivables avoids external borrowing costs.",
    dataPoints: [
      { label: "Debtor", value: "Boutique Siam" },
      { label: "Invoice #", value: "#BS-8820" },
      { label: "Overdue", value: "21.4 Days" },
      { label: "Target Date", value: "20 Oct 2026" },
    ],
  },
  {
    id: "step-3-funding",
    stepNumber: 3,
    agentId: "funding",
    agentName: "Funding Agent",
    agentEmoji: "💰",
    agentRole: "Working Capital & Terms",
    agentColor: "#EAB308",
    title: "Negotiated 60-Day Supplier Deferral",
    actionSummary: "Leveraged 12-month verified trade history to defer ¥100k to 25 Dec at 1.1% fee with Mr. Chen.",
    keyMetric: "1.1% Fee (~฿5.3k)",
    metricType: "info",
    detailedReasoning:
      "Evaluated 6 financing routes. Chen Tech's export credit partner offers 60-day terms at 1.1% fee (~฿5,307). This pushes the ¥100k outflow to 25 Dec, preserving 100% of the buffer with zero bank debt.",
    dataPoints: [
      { label: "New Due Date", value: "25 Dec 2026" },
      { label: "Fee Rate", value: "1.1% (~฿5,307)" },
      { label: "Buffer Saved", value: "100%" },
      { label: "Backup Loan", value: "Krungthai 9.5% APR" },
    ],
  },
  {
    id: "step-4-true-cost",
    stepNumber: 4,
    agentId: "true-cost",
    agentName: "True Cost Agent",
    agentEmoji: "🔍",
    agentRole: "APR & Fraud Shield",
    agentColor: "#EF4444",
    title: "Blocked Predatory Loan & Locked Verified Rail",
    actionSummary: "Rejected '1% a day' loan ad (365% APR) and locked transfer to verified China Construction Bank rail.",
    keyMetric: "365% APR Blocked",
    metricType: "shield",
    detailedReasoning:
      "Evaluated financing advertisements. Flagged an external '1% a day' loan as predatory (365% annual APR vs 15% BOT statutory limit). Verified payee bank against trade registry to eliminate invoice hijacking.",
    dataPoints: [
      { label: "Trap Detected", value: "1% / day ad" },
      { label: "Real APR", value: "365.0% / yr" },
      { label: "BOT Cap", value: "15.0% max" },
      { label: "Verified Rail", value: "CCB Registry" },
    ],
  },
  {
    id: "step-5-trust",
    stepNumber: 5,
    agentId: "trust",
    agentName: "Trust Agent",
    agentEmoji: "🛡️",
    agentRole: "Security Gatekeeper",
    agentColor: "#6366F1",
    title: "Packaged 3 Approvals with Face ID Step-Up",
    actionSummary: "Enforced Zero-Surprise policy. Generated 3 non-destructive inbox cards and required Face ID on FX transfer.",
    keyMetric: "Face ID Required",
    metricType: "shield",
    detailedReasoning:
      "Zero actions execute without explicit owner sign-off. Structured the strategy into 3 approval cards in Central Inbox. The foreign currency transfer requires biometric Face ID confirmation.",
    dataPoints: [
      { label: "Zero-Surprise", value: "Enforced" },
      { label: "Inbox Items", value: "3 Cards Ready" },
      { label: "Auth Level", value: "Face ID Step-Up" },
      { label: "Audit Ledger", value: "SHA-256 Logged" },
    ],
  },
];

interface OptionComparison {
  id: string;
  title: string;
  status: "RECOMMENDED" | "BACKUP" | "PARTIAL" | "BLOCKED";
  badgeText: string;
  badgeStyle: string;
  cost: string;
  apr: string;
  verdict: string;
}

const COMPARISON_OPTIONS: OptionComparison[] = [
  {
    id: "opt-1",
    title: "60-Day Supplier Terms (Chen Tech)",
    status: "RECOMMENDED",
    badgeText: "Recommended (Rank 1)",
    badgeStyle: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    cost: "1.1% one-time fee (~฿5,307)",
    apr: "6.6% APR equivalent",
    verdict: "Cheapest capital. Defers ¥100k outflow to 25 Dec, preserving buffer with 0 debt.",
  },
  {
    id: "opt-2",
    title: "Krungthai 'Sip Muen' SME Loan",
    status: "BACKUP",
    badgeText: "Evaluated Backup (Rank 2)",
    badgeStyle: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800",
    cost: "9.5% APR interest (~฿4,750 / yr)",
    apr: "9.5% APR per annum",
    verdict: "Strong fallback. Qualifies automatically with 78 Health Score (Grade B+).",
  },
  {
    id: "opt-3",
    title: "Invoice Factoring (Boutique Siam)",
    status: "PARTIAL",
    badgeText: "Evaluated Partial (Rank 3)",
    badgeStyle: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    cost: "2.5% factoring fee (฿875)",
    apr: "15.0% APR equivalent",
    verdict: "Provides quick ฿28k advance (80%), but does not cover the full order alone.",
  },
  {
    id: "opt-4",
    title: "'Fast Cash 1% a Day' Loan Ad",
    status: "BLOCKED",
    badgeText: "BLOCKED - PREDATORY",
    badgeStyle: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800",
    cost: "Deceptive: 'Only 1% / day'",
    apr: "365.0% Compounded APR",
    verdict: "Exceeds 15% Bank of Thailand statutory ceiling by 24x. Flagged and rejected.",
  },
];

export default function CollaborativePlanPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"trace" | "comparison" | "actions">("trace");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
  }, [router]);

  const toggleExpand = (id: string) => {
    setExpandedStepId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <span>←</span>
              <span>Dashboard</span>
            </Link>

            <Link href="/" className="inline-flex items-center gap-2">
              <span
                style={{ fontFamily: "var(--font-logo)" }}
                className="text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent"
              >
                BizMate
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-semibold">
              ⚡ Glass-Box Trace
            </span>
            <ThemeToggle />
            <UserProfileMenu user={user} onLogout={() => router.push("/")} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Title & One-line Summary */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              The Agents&apos; Joint Plan
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              How 6 agents synchronized to resolve the 26 Oct cash dip while protecting your ฿80,000 buffer.
            </p>
          </div>

          <Link
            href="/dashboard#inbox-approvals"
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs self-start sm:self-center flex items-center gap-1.5"
          >
            <span>📬</span>
            <span>Approval Inbox (3)</span>
          </Link>
        </div>

        {/* Executive Summary Card (Ultra-Compact) */}
        <section className="mb-6">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md border border-blue-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-bold shrink-0">
                ⚡
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Target: 26 Oct Liquidity Dip</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-blue-100">
                    ¥100k Order
                  </span>
                </div>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  Recover ฿35k overdue AR + Defer ¥100k for 60 days @ 1.1% fee. 0 bank debt.
                </p>
              </div>
            </div>

            {/* Quick Before vs After Badges */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-center">
                <div className="text-[9px] font-mono text-rose-300 uppercase">Without Plan</div>
                <div className="text-sm font-black text-rose-400 font-mono">฿64,000 ❌</div>
              </div>
              <div className="text-slate-400 text-xs">→</div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-center">
                <div className="text-[9px] font-mono text-emerald-300 uppercase">With Plan</div>
                <div className="text-sm font-black text-emerald-400 font-mono">฿115,000+ ✅</div>
              </div>
            </div>
          </div>
        </section>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-5">
          <button
            onClick={() => setActiveTab("trace")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "trace"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            }`}
          >
            Deliberation Trace (5 Steps)
          </button>
          <button
            onClick={() => setActiveTab("comparison")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "comparison"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            }`}
          >
            Compare Alternatives (4)
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "actions"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            }`}
          >
            3 Inbox Approvals
          </button>
        </div>

        {/* TAB 1: DELIBERATION TRACE (Progressive Disclosure / Accordions) */}
        {activeTab === "trace" && (
          <div className="space-y-3">
            {DELIBERATION_STEPS.map((step) => {
              const isExpanded = expandedStepId === step.id;
              return (
                <div
                  key={step.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs transition-all"
                >
                  {/* Scannable Header Row */}
                  <div
                    onClick={() => toggleExpand(step.id)}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: `${step.agentColor}20`, color: step.agentColor }}
                      >
                        {step.agentEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {step.stepNumber}. {step.title}
                          </span>
                          <span className="hidden md:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {step.agentName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {step.actionSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg ${
                          step.metricType === "warning"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : step.metricType === "success"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : step.metricType === "shield"
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {step.keyMetric}
                      </span>
                      <span className="text-xs text-slate-400 transition-transform duration-200">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Accordion: Deep Glass-Box Reasoning */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs animate-in fade-in duration-150">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 my-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                          Glass-Box Reasoning:
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {step.detailedReasoning}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        {step.dataPoints.map((dp, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
                          >
                            <span className="text-[9px] font-mono text-slate-400 uppercase block">
                              {dp.label}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                              {dp.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: COMPARISON (Crisp Visual Cards) */}
        {activeTab === "comparison" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {COMPARISON_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
                  opt.status === "RECOMMENDED"
                    ? "border-emerald-500 ring-1 ring-emerald-500/40 shadow-xs"
                    : opt.status === "BLOCKED"
                    ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${opt.badgeStyle}`}>
                    {opt.badgeText}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                    {opt.apr}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {opt.title}
                </h3>

                <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[11px] flex items-center justify-between">
                  <span className="text-slate-400">Total Cost:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{opt.cost}</span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {opt.verdict}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: 3 APPROVAL ACTIONS */}
        {activeTab === "actions" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded">
                  Step 1 • Collections
                </span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                  Follow Up ฿35k AR (Boutique Siam)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Polite LINE reminder for Invoice #BS-8820 (21.4 days overdue).
                </p>
              </div>
              <Link
                href="/dashboard#inbox-approvals"
                className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Review Draft →
              </Link>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 px-2 py-0.5 rounded">
                  Step 2 • Funding
                </span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                  Request 60-Day Supplier Terms
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Bilingual proposal to defer ¥100k to 25 Dec at 1.1% fee with Mr. Chen.
                </p>
              </div>
              <Link
                href="/dashboard#inbox-approvals"
                className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Inspect Proposal →
              </Link>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                  Step 3 • Security &amp; Trust
                </span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                  Authorize Verified FX Rail
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Locked to verified CCB recipient account. Requires Face ID sign-off.
                </p>
              </div>
              <Link
                href="/dashboard#inbox-approvals"
                className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Authorize with Face ID →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
