"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, clearSession, AuthUser } from "@/lib/auth-client";

// The 6 Autonomous Agents Metadata matching DESIGN_SYSTEM.md & instruction.md
const AGENTS_LIST = [
  {
    id: "cash",
    name: "Cash Agent",
    role: "13-Week Cash Radar",
    emoji: "📊",
    color: "#0284C7",
    badge: "Radar Live",
    stat: "฿80,000 Safety Buffer",
    insight: "Low cash week flagged: 26 Oct (Chen Tech ¥100k due)",
    actionLabel: "View Radar",
    href: "/dashboard/cash",
  },
  {
    id: "health",
    name: "Health Agent",
    role: "Financial Health Score",
    emoji: "🩺",
    color: "#2563EB",
    badge: "Grade B+",
    stat: "78 / 100 Health Score",
    insight: "Prime credit eligible • 7-factor hygiene sound",
    actionLabel: "Score Breakdown",
    href: "#health-score",
  },
  {
    id: "funding",
    name: "Funding Agent",
    role: "Working Capital & Terms",
    emoji: "💰",
    color: "#EAB308",
    badge: "1.1% Rate",
    stat: "60 Days Terms Match",
    insight: "Chen Tech deferral saves ฿80k buffer on 26 Oct",
    actionLabel: "Compare 6 Options",
    href: "#funding-options",
  },
  {
    id: "collections",
    name: "Collections Agent",
    role: "Smart AR Follow-ups",
    emoji: "🔔",
    color: "#F97316",
    badge: "Automated",
    stat: "฿35,000 Owed (1 Invoice)",
    insight: "Boutique Siam 21 days late • Polite LINE ready",
    actionLabel: "View AR Ledger",
    href: "/dashboard/collections",
  },
  {
    id: "true-cost",
    name: "True Cost Agent",
    role: "APR & Fraud Shield",
    emoji: "🔍",
    color: "#EF4444",
    badge: "Protected",
    stat: "0% Traps Detected",
    insight: "Shenzhen recipient registry verified • 0% fraud",
    actionLabel: "Risk Analyzer",
    href: "/dashboard/true-cost",
  },
  {
    id: "trust",
    name: "Trust Agent",
    role: "Security Gatekeeper",
    emoji: "🛡️",
    color: "#6366F1",
    badge: "Enforced",
    stat: "Face ID Required",
    insight: "Zero-Surprise Guardrail armed • 3 pending approvals",
    actionLabel: "Audit Ledger",
    href: "#audit-ledger",
  },
];

// 13-Week Cash Radar Mock Projections (Ploy Select Co., Ltd.)
// Baseline Buffer: ฿80,000. Critical conflict week: Week 3 (26 Oct).
interface WeekData {
  week: string;
  date: string;
  balance: number;
  status: "safe" | "below" | "short";
  heightPercent: number;
  inflow: number;
  outflow: number;
  note?: string;
}

const WEEKS_DATA: WeekData[] = [
  { week: "W1", date: "12 Oct", balance: 245000, status: "safe", heightPercent: 78, inflow: 85000, outflow: 42000 },
  { week: "W2", date: "19 Oct", balance: 215000, status: "safe", heightPercent: 68, inflow: 62000, outflow: 92000 },
  { week: "W3", date: "26 Oct", balance: 64000, status: "below", heightPercent: 26, inflow: 45000, outflow: 196000, note: "Below ฿80k Buffer (Chen Tech ¥100k due)" },
  { week: "W4", date: "02 Nov", balance: 112000, status: "safe", heightPercent: 44, inflow: 98000, outflow: 50000 },
  { week: "W5", date: "09 Nov", balance: 148000, status: "safe", heightPercent: 52, inflow: 76000, outflow: 40000 },
  { week: "W6", date: "16 Nov", balance: 135000, status: "safe", heightPercent: 48, inflow: 55000, outflow: 68000 },
  { week: "W7", date: "23 Nov", balance: 160000, status: "safe", heightPercent: 56, inflow: 80000, outflow: 55000 },
  { week: "W8", date: "30 Nov", balance: 182000, status: "safe", heightPercent: 62, inflow: 92000, outflow: 70000 },
  { week: "W9", date: "07 Dec", balance: 195000, status: "safe", heightPercent: 65, inflow: 88000, outflow: 75000 },
  { week: "W10", date: "14 Dec", balance: 210000, status: "safe", heightPercent: 70, inflow: 95000, outflow: 80000 },
  { week: "W11", date: "21 Dec", balance: 228000, status: "safe", heightPercent: 74, inflow: 102000, outflow: 84000 },
  { week: "W12", date: "28 Dec", balance: 240000, status: "safe", heightPercent: 77, inflow: 115000, outflow: 103000 },
  { week: "W13", date: "04 Jan", balance: 265000, status: "safe", heightPercent: 84, inflow: 120000, outflow: 95000 },
];

interface FinancialSummaryState {
  company: string;
  referenceDate: string;
  currentCashToday: number;
  formattedCurrentCash: string;
  safetyBuffer: number;
  cashRadarWeeks: WeekData[];
  buyerHabits: Array<{
    name: string;
    habit: string;
    averageDelayDays: number;
    totalPaidPastYear: number;
    currentOverdueAmount: number;
    invoiceStatus: string;
  }>;
  supplierHistory: {
    name: string;
    supplierId: string;
    totalTransfersCount: number;
    totalCnySpent: number;
    totalThbSpent: number;
    monthsActive: number;
    verifiedRail: boolean;
    pendingOrderCny: number;
    pendingOrderCurrency: string;
    pendingOrderAmount: number;
    pendingOrderThb: number;
    pendingDueDate: string;
  };
  healthScore: {
    overallScore: number;
    ratingGrade: string;
    creditStatus: string;
    factors: Array<{
      name: string;
      score: number;
      weight: number;
      status: string;
      evidence: string;
    }>;
  };
  anomaliesCount: number;
  totalTransactionsInStatement: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bank Connection State (Simulates connected bank vs fresh/reset user)
  const [isBankConnected, setIsBankConnected] = useState(false);
  const [weeksData, setWeeksData] = useState<WeekData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(2);

  // Real data state
  const [financialSummary, setFinancialSummary] = useState<FinancialSummaryState | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Array<{
    txn_id: string;
    datetime: string;
    channel: string;
    counterparty_name: string;
    type: string;
    amount: number;
    balance_after: number;
    category: string;
    metadata?: { notes?: string; core_conflict_trigger?: boolean };
  }>>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>("ALL");
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(3);
  const [inboxItems, setInboxItems] = useState<Array<{ id: string; agentId: string; title: string; description: string; impact: string; status: string; requiresFaceId: boolean }>>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<Array<{ id: string; agentId: string; action: string; status: string; timestamp: string }>>([]);

  // Dev reset modal state
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>("kbank");
  const [enabledBankIds, setEnabledBankIds] = useState<string[]>([]);
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);

  // Check stored bank connection state, active banks and selected bank on mount
  useEffect(() => {
    const handleSyncBanks = () => {
      if (typeof window !== "undefined") {
        const storedBankState = localStorage.getItem("bizmate_bank_connected");
        const storedBankChoice = localStorage.getItem("bizmate_selected_bank") || "kbank";
        setSelectedBank(storedBankChoice);

        try {
          const raw = localStorage.getItem("bizmate_enabled_banks");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setEnabledBankIds(parsed);
            }
          }
        } catch {}

        if (storedBankState === "true") {
          setIsBankConnected(true);
        } else if (storedBankState === "false") {
          setIsBankConnected(false);
        } else {
          setIsBankConnected(false);
        }
      }
    };

    handleSyncBanks();
    window.addEventListener("bizmate_bank_changed", handleSyncBanks);
    return () => {
      window.removeEventListener("bizmate_bank_changed", handleSyncBanks);
    };
  }, []);

  const handleSelectBank = (bankId: string) => {
    setSelectedBank(bankId);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_selected_bank", bankId);
      window.dispatchEvent(new Event("bizmate_bank_changed"));
    }
  };

  // Fetch live statement data ONLY when bank is connected
  useEffect(() => {
    if (!isBankConnected) {
      setFinancialSummary(null);
      setWeeksData([]);
      setSelectedWeek(null);
      setRecentTransactions([]);
      setInboxItems([]);
      setPendingApprovalsCount(0);
      return;
    }

    // Check if user has multiple enabled banks
    let effectiveQuery = `bankId=${selectedBank}`;
    if (enabledBankIds.length > 0) {
      effectiveQuery = `bankIds=${enabledBankIds.join(",")}`;
    } else if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("bizmate_enabled_banks");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            effectiveQuery = `bankIds=${parsed.join(",")}`;
          }
        }
      } catch {}
    }

    setIsRefreshingData(true);

    // Fetch live financial summary computed for active banks + active custom What-If scenarios & custom safety buffer
    const fetchSummary = Promise.all([
      fetch(`/api/financial/summary?${effectiveQuery}`).then((r) => r.json()),
      fetch(`/api/financial/what-if?bankId=${selectedBank}`).then((r) => r.json()).catch(() => ({ scenarios: [] })),
    ])
      .then(([data, whatIfData]) => {
        if (data && data.cashRadarWeeks) {
          // Check for user-customized safety buffer
          let activeBuffer = data.safetyBuffer || 80000;
          if (typeof window !== "undefined") {
            const storedBuffer = localStorage.getItem(`bizmate_custom_buffer_${selectedBank}`);
            if (storedBuffer) {
              const parsed = parseFloat(storedBuffer);
              if (!isNaN(parsed)) activeBuffer = parsed;
            }
          }

          // Active scenarios
          const scenarios = Array.isArray(whatIfData?.scenarios)
            ? whatIfData.scenarios.filter((s: { isEnabled: boolean }) => s.isEnabled)
            : [];

          let runningBalance = data.currentCashToday;
          const computedWeeks: WeekData[] = data.cashRadarWeeks.map((baseW: WeekData, idx: number) => {
            let modInflow = baseW.inflow;
            let modOutflow = baseW.outflow;
            const extraNotes: string[] = [];

            scenarios.forEach((sc: { weekIndex: number; type: string; amount: number; name: string }) => {
              if (sc.weekIndex === idx) {
                const formattedAmt = sc.amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
                if (sc.type === "INFLOW") {
                  modInflow += sc.amount;
                  extraNotes.push(`${sc.name} (+฿${formattedAmt})`);
                } else {
                  modOutflow += sc.amount;
                  extraNotes.push(`${sc.name} (-฿${formattedAmt})`);
                }
              }
            });

            if (idx === 0) {
              runningBalance = data.currentCashToday + modInflow - modOutflow;
            } else {
              runningBalance = runningBalance + modInflow - modOutflow;
            }

            const bal = Math.round(runningBalance);
            let status: "safe" | "below" | "short" = "safe";
            if (bal <= 0) {
              status = "short";
            } else if (bal < activeBuffer) {
              status = "below";
            }

            let finalNote = baseW.note;
            if (extraNotes.length > 0) {
              finalNote = (finalNote ? `${finalNote} • ` : "") + extraNotes.join(", ");
            }

            const heightPercent = Math.min(100, Math.max(16, Math.round((bal / Math.max(350000, activeBuffer * 2.2)) * 100)));

            return {
              ...baseW,
              inflow: modInflow,
              outflow: modOutflow,
              balance: bal,
              status,
              heightPercent,
              note: finalNote,
            };
          });

          const enhancedSummary = {
            ...data,
            safetyBuffer: activeBuffer,
            cashRadarWeeks: computedWeeks,
          };

          setFinancialSummary(enhancedSummary);
          setWeeksData(computedWeeks);

          const conflictIdx = computedWeeks.findIndex((w: WeekData) => w.status === "below" || w.status === "short");
          const targetIdx = conflictIdx !== -1 ? conflictIdx : 2;
          setSelectedWeek(computedWeeks[targetIdx] || computedWeeks[0]);
          setSelectedWeekIndex(targetIdx);
        }
      })
      .catch((err) => console.error("Error loading financial summary:", err));

    // Fetch initial sample transactions from statement
    const fetchTx = fetch(`/api/financial/transactions?limit=8&${effectiveQuery}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.transactions) {
          setRecentTransactions(data.transactions);
        }
      })
      .catch(() => {});

    // Fetch inbox items count & items
    const session = getSession();
    let fetchInbox = Promise.resolve();
    if (session?.token) {
      fetchInbox = fetch(`/api/inbox?bankConnected=true&${effectiveQuery}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.items) {
            setInboxItems(data.items);
            setPendingApprovalsCount(data.items.filter((i: { status: string }) => i.status === "PENDING").length);
          }
        })
        .catch(() => {});
    }

    Promise.allSettled([fetchSummary, fetchTx, fetchInbox]).finally(() => {
      setIsRefreshingData(false);
    });
  }, [isBankConnected, selectedBank, enabledBankIds]);

  // Load Session and verify data
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);

    // Fetch audit logs
    fetch("/api/trust/audit", {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) {
          setRecentAuditLogs(data.logs.slice(0, 4));
        }
      })
      .catch(() => {});

    setIsLoading(false);
  }, [router]);

  // Filter transactions dynamically
  const handleFilterTransactions = (filterType: string) => {
    setSelectedFilterCategory(filterType);
    let url = `/api/financial/transactions?limit=8&bankId=${selectedBank}`;
    if (filterType === "SHOPEE") url += "&channel=Shopee";
    else if (filterType === "TIKTOK") url += "&channel=TikTok";
    else if (filterType === "LAZADA") url += "&channel=Lazada";
    else if (filterType === "QR") url += "&channel=PromptPay";
    else if (filterType === "SUPPLIER") url += "&category=SUPPLIER_PURCHASE";
    else if (filterType === "ANOMALY") url += "&category=SECURITY_ANOMALY_BLOCKED";

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.transactions) {
          setRecentTransactions(data.transactions);
        }
      })
      .catch(() => {});
  };

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  // Developer Reset Handler
  const handleDeveloperReset = async () => {
    const session = getSession();
    if (!session?.token) {
      router.push("/login");
      return;
    }

    setIsResetting(true);
    setResetMessage(null);

    try {
      const res = await fetch("/api/dev/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset");
      }

      // Toggle state: when dev reset, simulate fresh user without bank connection
      setIsBankConnected(false);
      setFinancialSummary(null);
      setWeeksData([]);
      setSelectedWeek(null);
      setRecentTransactions([]);
      setInboxItems([]);
      setPendingApprovalsCount(0);

      if (typeof window !== "undefined") {
        localStorage.setItem("bizmate_bank_connected", "false");
        localStorage.removeItem("bizmate_selected_bank");
      }
      setResetMessage("Database reset to fresh baseline! All computed data and approvals wiped.");
      setShowConfirmModal(false);

      // Re-fetch inbox items & audit logs
      fetch("/api/inbox?bankConnected=false", {
        headers: { Authorization: `Bearer ${session.token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.items) {
            setInboxItems(d.items);
            setPendingApprovalsCount(d.items.filter((i: any) => i.status === "PENDING").length);
          }
        })
        .catch(() => {});

      fetch("/api/trust/audit", {
        headers: { Authorization: `Bearer ${session.token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.logs) setRecentAuditLogs(d.logs.slice(0, 4));
        })
        .catch(() => {});

      setTimeout(() => setResetMessage(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error resetting database";
      setResetMessage(message);
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold">Loading BizMateAI Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col pb-16">
      {/* Universal Top Navigation Header */}
      <AppHeader
        user={user}
        activeNav="dashboard"
        onDevReset={() => setShowConfirmModal(true)}
        isBankConnected={isBankConnected}
        selectedBank={selectedBank}
        onSelectBank={handleSelectBank}
        onToggleBank={() => {
          const nextState = !isBankConnected;
          setIsBankConnected(nextState);
          if (typeof window !== "undefined") {
            localStorage.setItem("bizmate_bank_connected", String(nextState));
          }
        }}
      />

      {/* Main Dashboard Hub (HM-01) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        {/* Reset Notification Toast */}
        {resetMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <span>✅</span>
              <span>{resetMessage}</span>
            </div>
            <button
              onClick={() => setResetMessage(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================
            HERO CARD (The Big Box):
            State A: Connected Bank -> Cash Radar (Cash Today + 13 Weeks)
            State B: First-time / Dev Reset -> Onboarding CTA Card
        ======================================================== */}
        <section className="mb-8">
          {isBankConnected ? (
            /* STATE A: THE BIG HERO BOX - CASH TODAY & 13-WEEK RADAR */
            <div className={`rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 dark:from-blue-700 dark:via-indigo-800 dark:to-slate-900 text-white shadow-2xl border border-blue-500/30 dark:border-slate-800 relative overflow-hidden transition-all duration-300 animate-fade-in-up ${
              isRefreshingData ? "opacity-90 transition-opacity" : "opacity-100"
            }`}>
              {/* Subtle ambient gradient aura */}
              <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 dark:bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-white/20 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-200 dark:text-sky-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                      Live Cash Today • {financialSummary?.company || "Operating Account"}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/15 dark:bg-slate-800/80 text-white dark:text-slate-200 border border-white/20 dark:border-slate-700">
                      Read-Only Sync
                    </span>
                    {isRefreshingData && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/40 flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin inline-block" />
                        Aggregating Banks...
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-3 mt-2">
                    <h1 className={`text-4xl sm:text-5xl font-black tracking-tight text-white font-mono drop-shadow-sm transition-opacity duration-300 ${
                      isRefreshingData ? "opacity-70" : "opacity-100"
                    }`}>
                      {financialSummary?.formattedCurrentCash || "฿145,628"}
                    </h1>
                    {financialSummary?.buyerHabits?.[0] && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                        +฿{financialSummary.buyerHabits[0].currentOverdueAmount.toLocaleString()} incoming via {financialSummary.buyerHabits[0].name}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-blue-100 dark:text-slate-300 mt-2 max-w-lg leading-relaxed">
                    Default Safety Buffer: <strong className="text-white font-bold">฿{financialSummary?.safetyBuffer?.toLocaleString() || "80,000"}</strong>.
                    {(() => {
                      const conflictWeek = weeksData.find((w) => w.status === "below" || w.status === "short");
                      if (conflictWeek) {
                        return (
                          <>
                            {" "}Earliest projected low-cash threshold:{" "}
                            <span
                              className="text-amber-300 dark:text-amber-400 font-bold underline cursor-pointer hover:text-white transition-colors"
                              onClick={() => {
                                const idx = weeksData.indexOf(conflictWeek);
                                setSelectedWeek(conflictWeek);
                                setSelectedWeekIndex(idx !== -1 ? idx : 0);
                              }}
                            >
                              {conflictWeek.week} ({conflictWeek.date})
                            </span>{" "}
                            {financialSummary?.supplierHistory?.name && financialSummary.supplierHistory.pendingOrderAmount > 0
                              ? `due to ${financialSummary.supplierHistory.name} ${financialSummary.supplierHistory.pendingOrderCurrency || "¥"}${financialSummary.supplierHistory.pendingOrderAmount.toLocaleString()} payment.`
                              : "due to planned operational expenses."}
                          </>
                        );
                      }
                      return (
                        <> Liquidity buffer maintained safely across all projected weeks.</>
                      );
                    })()}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(new Event("bizmate_open_bank_settings"));
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-white border border-white/25 dark:border-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <span>Manage Banks &amp; Feeds</span>
                      <span>⚙️</span>
                    </button>
                    <Link
                      href="/dashboard/cash"
                      className="px-4 py-2.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/35 border border-sky-300/40 text-white text-xs font-bold transition-all shadow-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <span>Adjust What-If &amp; Buffer</span>
                      <span>⚡</span>
                    </Link>
                    <Link
                      href="#joint-plan"
                      className="px-4 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 dark:bg-blue-500 dark:hover:bg-blue-600 dark:text-white text-xs font-bold shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer text-center"
                    >
                      View Joint Remedy Plan →
                    </Link>
                  </div>

                  {/* Mascot Bot2 sitting inside hero card */}
                  <div className="hidden md:block relative w-20 h-20 lg:w-24 lg:h-24 shrink-0 drop-shadow-xl hover:scale-105 transition-transform duration-300">
                    <Image
                      src="/images/bot2.png"
                      alt="BizMateAI Mascot Bot"
                      width={96}
                      height={96}
                      className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
                    />
                  </div>
                </div>
              </div>

              {/* 13-Week Interactive Mini Spark-Bars */}
              <div className="relative z-10 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Link href="/dashboard/cash" className="text-xs font-bold text-sky-100 dark:text-sky-200 hover:underline flex items-center gap-1 group">
                      <span>13-Week Cash Radar Forecast</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </Link>
                    <span className="text-[11px] font-mono text-blue-200/80 dark:text-slate-400">(Live statement-backed rolling liquidity)</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-blue-100 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-white dark:bg-sky-400" /> Safe (&ge; ฿{((financialSummary?.safetyBuffer || 80000) / 1000).toFixed(0)}k)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-200 dark:text-amber-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-300" /> Below Buffer
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-200 dark:text-rose-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Short (&le; 0)
                    </span>
                  </div>
                </div>

                {/* Bars Grid */}
                <div className="grid grid-cols-13 gap-1.5 sm:gap-2.5 h-32 items-end bg-black/25 dark:bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/15 dark:border-slate-800 backdrop-blur-xs">
                  {weeksData.map((w, idx) => {
                    const isFocus = selectedWeekIndex === idx;
                    const barColor =
                      w.status === "below"
                        ? "bg-amber-300 hover:bg-amber-200"
                        : w.status === "short"
                        ? "bg-rose-400 hover:bg-rose-300"
                        : "bg-white hover:bg-white/90";

                    return (
                      <div
                        key={w.week}
                        onClick={() => {
                          setSelectedWeek(w);
                          setSelectedWeekIndex(idx);
                        }}
                        className="group flex flex-col items-center justify-end h-full cursor-pointer relative"
                      >
                        {/* Selected Indicator Pin */}
                        {isFocus && (
                          <div className="absolute -top-3 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-xs animate-bounce" />
                        )}

                        <div
                          style={{ height: `${w.heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${barColor} ${
                            isFocus ? "ring-2 ring-white shadow-lg" : "opacity-85 group-hover:opacity-100"
                          }`}
                        />
                        <span
                          className={`text-[10px] font-mono mt-1.5 transition-colors ${
                            isFocus ? "font-bold text-white" : "text-blue-100/70 dark:text-slate-400 group-hover:text-white"
                          }`}
                        >
                          {w.week}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Week Inspector Strip */}
                {selectedWeek && (
                  <div className="mt-3 p-3.5 rounded-xl bg-black/25 dark:bg-black/40 border border-white/15 dark:border-slate-800 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded bg-white text-[11px]">
                        {selectedWeek.week} ({selectedWeek.date})
                      </span>
                      <span className="text-white dark:text-slate-200">
                        Projected End-of-Week:{" "}
                        <strong className="text-white font-mono font-bold">
                          ฿{selectedWeek.balance.toLocaleString()}
                        </strong>
                      </span>
                      {selectedWeek.note && (
                        <span className="text-amber-200 dark:text-amber-300 font-semibold flex items-center gap-1">
                          ⚠️ {selectedWeek.note}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-blue-100 dark:text-slate-300 flex items-center gap-3">
                      <span>Inflow: +฿{selectedWeek.inflow.toLocaleString()}</span>
                      <span>•</span>
                      <span>Outflow: -฿{selectedWeek.outflow.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STATE B: FIRST-TIME USER / DEV RESET - BIG WELCOME ONBOARDING HERO BOX */
            <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 dark:from-blue-700 dark:via-indigo-800 dark:to-slate-900 text-white shadow-2xl border border-blue-500/30 dark:border-slate-800 relative overflow-hidden transition-all duration-300 animate-fade-in-up">
              <div className="relative z-10 max-w-2xl">
                <span className="text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/20 dark:bg-white/10 text-white backdrop-blur-sm inline-block mb-3 border border-white/20 dark:border-white/10">
                  ⚡ Setup Required • First-Time Deployment
                </span>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  Welcome to BizMateAI, {user?.businessName}!
                </h1>
                <p className="text-xs sm:text-sm text-blue-100 mt-2.5 leading-relaxed">
                  Your autonomous multi-agent financial team is ready. To unlock the <strong>13-Week Cash Radar</strong>, <strong>Real-Time Cash Today</strong>, and <strong>Automated AR Follow-ups</strong>, connect your read-only operating account.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/onboarding"
                    className="px-6 py-3.5 rounded-2xl bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs shadow-lg shadow-black/10 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2"
                  >
                    <span>Connect Bank &amp; Sales Channels →</span>
                  </Link>

                  <button
                    onClick={() => {
                      setIsBankConnected(true);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("bizmate_bank_connected", "true");
                      }
                    }}
                    className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/25 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Demo Mock: Sim Connected Bank
                  </button>
                </div>
              </div>

              {/* Illustration Accent & Sitting Bot2 Mascot */}
              <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="hidden sm:block absolute bottom-4 right-8 w-28 h-28 lg:w-36 lg:h-36 drop-shadow-2xl pointer-events-none">
                <Image
                  src="/images/bot2.png"
                  alt="BizMateAI Mascot Bot"
                  width={144}
                  height={144}
                  className="w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)] animate-float"
                />
              </div>
            </div>
          )}
        </section>

        {/* ========================================================
            QUICK METRICS BAR (HM-01 Quick Metrics)
        ======================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {/* Quick Metric 1: Owed to you (CO-01) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Owed to You (AR)
              </span>
              <span className="text-lg">🔔</span>
            </div>
            <div className="my-2">
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {isBankConnected ? (
                  `฿${financialSummary?.buyerHabits?.[0]?.currentOverdueAmount?.toLocaleString() || "0"}`
                ) : (
                  <span className="text-slate-400 font-normal text-xl">฿--</span>
                )}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 font-medium">
                {isBankConnected
                  ? financialSummary?.buyerHabits?.[0]
                    ? `${financialSummary.buyerHabits[0].name} (${financialSummary.buyerHabits[0].averageDelayDays}d avg delay)`
                    : "No overdue receivables"
                  : "Awaiting Bank & AR Ledger sync"}
              </p>
            </div>
            {isBankConnected ? (
              <Link
                href="/dashboard/collections"
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
              >
                <span>View AR ledger</span>
                <span>→</span>
              </Link>
            ) : (
              <span className="text-[11px] font-mono text-slate-400">Connect bank to scan invoices</span>
            )}
          </div>

          {/* Quick Metric 2: Health Score (HE-01) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Health Score
              </span>
              <span className="text-lg">🩺</span>
            </div>
            <div className="my-2">
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {isBankConnected ? (
                  `${financialSummary?.healthScore?.overallScore || 78} / 100`
                ) : (
                  <span className="text-slate-400 font-normal text-xl">-- / 100</span>
                )}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                {isBankConnected
                  ? `${financialSummary?.healthScore?.ratingGrade || "Grade B+"} • ${financialSummary?.healthScore?.creditStatus || "Prime Credit Eligible"}`
                  : "Awaiting 365-day cash flow history"}
              </p>
            </div>
            {isBankConnected ? (
              <Link
                href="#health-score"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Score details</span>
                <span>→</span>
              </Link>
            ) : (
              <span className="text-[11px] font-mono text-slate-400">Requires bank feed telemetry</span>
            )}
          </div>

          {/* Quick Metric 3: For your OK (IB-01) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                For Your OK
              </span>
              <span className="text-lg">📥</span>
            </div>
            <div className="my-2">
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {isBankConnected ? `${pendingApprovalsCount} Pending` : "0 Pending"}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                {isBankConnected ? "Zero-surprise approval queue" : "No dispatches until bank is verified"}
              </p>
            </div>
            <Link
              href="/inbox"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Open Inbox</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* ========================================================
            THE AGENTS' JOINT PLAN CARD (PL-01 Highlight Card)
        ======================================================== */}
        <section id="joint-plan" className="mb-8">
          {isBankConnected ? (
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/60 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center text-lg font-bold shadow-xs">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      The Agents&apos; Joint Plan: Liquidity &amp; Safety Optimization
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Synchronized remedy safeguarding your ฿{financialSummary?.safetyBuffer?.toLocaleString() || "80,000"} cash buffer.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-center">
                  <Link
                    href="/dashboard/plan"
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 shadow-xs hover:shadow-md transition-all cursor-pointer"
                    title="View transparent deliberation trace showing how the 6 agents synchronized this plan"
                  >
                    <span>How they decided</span>
                    <span>→</span>
                  </Link>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-xl border border-amber-300 dark:border-amber-800">
                    Transparent Deliberation
                  </span>
                </div>
              </div>

              {/* The 3 Synchronized Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400">
                      Step 1 • Collections
                    </span>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      {financialSummary?.buyerHabits?.[0] ? `+฿${financialSummary.buyerHabits[0].currentOverdueAmount.toLocaleString()}` : "AR Clean"}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {financialSummary?.buyerHabits?.[0] ? `Recover AR from ${financialSummary.buyerHabits[0].name}` : "Monitor Inflow Settlement"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {financialSummary?.buyerHabits?.[0]
                      ? `Automated polite reminder prepared (${financialSummary.buyerHabits[0].invoiceStatus}).`
                      : "All receivables currently settled on schedule."}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-yellow-600 dark:text-yellow-400">
                      Step 2 • Funding
                    </span>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      Saves Buffer
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {financialSummary?.supplierHistory && financialSummary.supplierHistory.pendingOrderAmount > 0
                      ? `Terms with ${financialSummary.supplierHistory.name}`
                      : "Working Capital Optimization"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {financialSummary?.supplierHistory && financialSummary.supplierHistory.pendingOrderAmount > 0
                      ? `Extend ${financialSummary.supplierHistory.pendingOrderCurrency || "¥"}${financialSummary.supplierHistory.pendingOrderAmount.toLocaleString()} payment terms to protect safety buffer.`
                      : "Maintain emergency cash reserve and sweep excess yield."}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
                      Step 3 • Security &amp; Trust
                    </span>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      Face ID
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Verified Disbursement Rail
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {financialSummary?.supplierHistory?.name
                      ? `Locked verified rail to ${financialSummary.supplierHistory.name} with biometric step-up.`
                      : "Protected transfers with biometric step-up and anti-phishing rail."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 text-xs text-slate-500 dark:text-slate-400 border-t border-amber-200/60 dark:border-amber-800/40">
                <span className="flex items-center gap-1.5">
                  <span>🛡️</span>
                  <span>Zero-Surprise: Actions require your sign-off in Central Inbox.</span>
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/plan"
                    className="font-bold text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <span>Read full trace</span>
                    <span>→</span>
                  </Link>
                  <span className="font-mono text-[11px]">12 Oct 2026</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Joint Remedy Plan Standby
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Agents require statement telemetry to detect liquidity breaches and synthesize multi-agent remedy plans.
                  </p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold whitespace-nowrap transition-colors"
              >
                Awaiting Bank Sync →
              </Link>
            </div>
          )}
        </section>

        {/* ========================================================
            THE 6 AGENT TILES GRID (HM-01 Agent Grid)
        ======================================================== */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Autonomous Agent Team (6 Active)
            </h2>
            <span className="text-xs font-mono text-slate-500">Live Telemetry</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS_LIST.map((agent) => {
              // Dynamic stats & insights derived from statement data per connected case
              let dynamicStat = agent.stat;
              let dynamicInsight = agent.insight;

              if (financialSummary) {
                const bufferThb = `฿${(financialSummary.safetyBuffer || 80000).toLocaleString()}`;
                const supplier = financialSummary.supplierHistory;
                const debtor = financialSummary.buyerHabits?.[0];
                const conflictW = weeksData.find((w) => w.status === "below" || w.status === "short");

                if (agent.id === "cash") {
                  dynamicStat = `${bufferThb} Safety Buffer`;
                  if (conflictW) {
                    const supShort = supplier?.name ? supplier.name.split(" ")[0] : "Supplier";
                    dynamicInsight = `Low cash week flagged: ${conflictW.date} (${supShort} ${supplier?.pendingOrderCurrency || "¥"}${supplier?.pendingOrderAmount ? (supplier.pendingOrderAmount / 1000).toFixed(0) + "k" : "due"})`;
                  } else {
                    dynamicInsight = "Liquidity safely exceeds operating safety buffer across all 13 weeks.";
                  }
                } else if (agent.id === "health") {
                  dynamicStat = `${financialSummary.healthScore?.overallScore || 78} / 100 Health Score`;
                  dynamicInsight = `${financialSummary.healthScore?.ratingGrade || "Grade B+"} • ${financialSummary.healthScore?.creditStatus || "Prime Credit Eligible"}`;
                } else if (agent.id === "funding") {
                  if (supplier && supplier.pendingOrderAmount > 0) {
                    const supShort = supplier.name.split(" ")[0];
                    dynamicStat = "60 Days Terms Match";
                    dynamicInsight = `${supShort} deferral saves ${bufferThb} buffer on 26 Oct`;
                  } else {
                    dynamicStat = "Yield Sweeper Active";
                    dynamicInsight = `Excess liquidity swept above ${bufferThb} safety buffer.`;
                  }
                } else if (agent.id === "collections") {
                  if (debtor && debtor.currentOverdueAmount > 0) {
                    dynamicStat = `฿${debtor.currentOverdueAmount.toLocaleString()} Owed (1 Invoice)`;
                    dynamicInsight = `${debtor.name} ${Math.round(debtor.averageDelayDays)} days late • Courtesy reminder ready`;
                  } else {
                    dynamicStat = "฿0 Overdue";
                    dynamicInsight = "All accounts receivable collected on schedule.";
                  }
                } else if (agent.id === "true-cost") {
                  const supShort = supplier?.name ? supplier.name.split(" ")[0] : "Verified";
                  dynamicStat = "0% Traps Detected";
                  dynamicInsight = `${supShort} recipient registry verified • 0% fraud`;
                } else if (agent.id === "trust") {
                  dynamicStat = "Face ID Required";
                  dynamicInsight = `Zero-Surprise Guardrail armed • ${pendingApprovalsCount} pending approvals`;
                }
              }

              return (
                <div
                  key={agent.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60"
                        >
                          {agent.emoji}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {agent.name}
                          </h3>
                          <p className="text-[11px] text-slate-500">{agent.role}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {agent.badge}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 font-mono">
                      {isBankConnected ? dynamicStat : "Awaiting Bank Linkage"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {isBankConnected ? dynamicInsight : "Telemetry feeds paused until operating account is verified."}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      {isBankConnected ? "Zero-Surprise OK" : "Standby"}
                    </span>
                    <Link href={isBankConnected ? agent.href : "/onboarding"} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      {isBankConnected ? `${agent.actionLabel} →` : "Connect Bank →"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================
            APPROVAL INBOX PREVIEW (Approvals Queue)
        ======================================================== */}
        <section id="inbox-approvals" className="mb-8 scroll-mt-20">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl">
                  📥
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Central Approval Queue</span>
                    {pendingApprovalsCount > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold">
                        {pendingApprovalsCount} Action{pendingApprovalsCount > 1 ? "s" : ""} Pending
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                        All Cleared
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Deterministic Guardrails: Outgoing communications and capital dispatches require explicit sign-off.
                  </p>
                </div>
              </div>

              <Link
                href="/inbox"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors shrink-0"
              >
                <span>Open Central Inbox</span>
                <span>→</span>
              </Link>
            </div>

            {/* List of Pending Items */}
            <div className="space-y-3">
              {inboxItems.filter((i) => i.status === "PENDING").length > 0 ? (
                inboxItems
                  .filter((i) => i.status === "PENDING")
                  .map((item) => {
                    const agent = AGENTS_LIST.find((a) => a.id === item.agentId.toLowerCase()) || {
                      name: "Trust Agent",
                      emoji: "🛡️",
                      color: "#6366F1",
                    };
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
                              style={{
                                backgroundColor: `${agent.color}15`,
                                color: agent.color,
                              }}
                            >
                              <span>{agent.emoji}</span>
                              <span>{agent.name}</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                              <span>🛡️</span>
                              <span>Trust Enforced</span>
                            </span>
                            {item.requiresFaceId && (
                              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                                🔐 Face ID Step-Up
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.description}
                          </p>
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 pt-1">
                            <span className="text-slate-400">Impact: </span>
                            <span className="font-semibold">{item.impact}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/inbox?item=${item.agentId}`}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          >
                            Review &amp; Authorize →
                          </Link>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/20 text-center text-xs text-slate-500 dark:text-slate-400">
                  {isBankConnected ? (
                    <span>✓ All approvals cleared! No pending actions in queue.</span>
                  ) : (
                    <span>🔒 Awaiting Bank Linkage. Actions will appear once financial statement is analyzed.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            STATEMENT LEDGER FEED (Ingested from mock_financial_statement_365d.json)
        ======================================================== */}
        <section className="mb-8">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
                  📑
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Transaction History</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Verified
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live feeds from sales channels and cross-border supplier rails.
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs">
                {[
                  { key: "ALL", label: "All Feeds" },
                  { key: "SHOPEE", label: "Shopee" },
                  { key: "TIKTOK", label: "TikTok" },
                  { key: "LAZADA", label: "Lazada" },
                  { key: "QR", label: "PromptPay QR" },
                  {
                    key: "SUPPLIER",
                    label: financialSummary?.supplierHistory?.name
                      ? financialSummary.supplierHistory.name.split(" ")[0]
                      : "Trade Supplier",
                  },
                  { key: "ANOMALY", label: "Red Flags" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleFilterTransactions(tab.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      selectedFilterCategory === tab.key
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transactions List Table */}
            <div className="overflow-x-auto">
              {isBankConnected ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Txn ID</th>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Channel / Counterparty</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {recentTransactions.map((tx) => {
                      const isCredit = tx.type === "CREDIT";
                      const isConflict = tx.metadata?.core_conflict_trigger;
                      return (
                        <tr
                          key={tx.txn_id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isConflict ? "bg-amber-50/60 dark:bg-amber-950/20 font-bold" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                            {tx.txn_id}
                            {isConflict && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-rose-500 text-white">
                                CONFLICT
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                            {tx.datetime.replace("+07:00", "").replace("T", " ")}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-sans">
                            <div className="font-medium">{tx.counterparty_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{tx.channel}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {tx.category}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isCredit ? "+" : "-"}฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                            ฿{tx.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-2xl flex items-center justify-center mx-auto mb-3">
                    🔒
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No Transaction Feeds Ingested
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                    Connect your operating bank account in the setup banner above to ingest and analyze 365 days of statement telemetry.
                  </p>
                  <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Connect Bank Now →</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>
                {isBankConnected
                  ? "Showing statement records from data/mock_financial_statement_365d.json"
                  : "Awaiting Bank Linkage • 0 Records Ingested"}
              </span>
              <span>100% Deterministic Engine</span>
            </div>
          </div>
        </section>

        {/* ========================================================
            ACTIVITY STREAM (Latest from your agents • TR-01 Audit Log)
        ======================================================== */}
        <section id="audit-ledger" className="mb-8">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">📜</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Agent Activity
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                ● Live Audit Feed
              </span>
            </div>

            <div className="space-y-3">
              {recentAuditLogs.length > 0 ? (
                recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono uppercase font-bold text-blue-600 dark:text-blue-400 text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
                        {log.agentId}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {log.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                  Audit log records ready. Activity will stream here automatically.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Developer Reset Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => !isResetting && setShowConfirmModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-2xl mb-4">
              ⚡
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Developer Reset Database?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              This action will reset your database state back to the <strong>demo baseline</strong>:
            </p>

            <ul className="text-xs text-slate-600 dark:text-slate-400 mt-3 space-y-1.5 list-disc list-inside bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 font-mono text-[11px]">
              <li>Clear chat message history</li>
              <li>Re-seed 3 Central Approval Inbox items</li>
              <li>Re-seed baseline Trust Agent audit logs</li>
              <li>Simulate unlinked bank state for First-Time User view</li>
            </ul>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleDeveloperReset}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Yes, Reset Database</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative">
            <button
              onClick={() => setShowAccountModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
                {(user?.businessName || user?.email || "U").trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {user?.businessName || "Business Account"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user?.email || "Authenticated User"}
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Account ID:</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                  {user?.id || "usr_demo_ploy"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Role:</span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px]">
                  Business Owner
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Security Gatekeeper:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>🛡️</span> Zero-Surprise Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Bank Integration:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isBankConnected ? "🟢 Connected (Kasikornbank)" : "⚪ Not Connected"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>🚪</span>
                <span>Log Out</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
