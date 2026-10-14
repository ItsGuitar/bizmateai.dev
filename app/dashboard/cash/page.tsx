"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";
import { BANK_DATASETS } from "@/lib/financial-service";

interface WeekForecast {
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

interface FinancialSummaryData {
  bankId: string;
  bankName: string;
  company: string;
  referenceDate: string;
  currentCashToday: number;
  formattedCurrentCash: string;
  safetyBuffer: number;
  cashRadarWeeks: WeekForecast[];
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
  };
  healthScore: {
    overallScore: number;
    ratingGrade: string;
    creditStatus: string;
  };
  activeBanksCount?: number;
}

interface StatementTransaction {
  txn_id: string;
  datetime: string;
  channel: string;
  counterparty_name: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balance_after: number;
  category: string;
  metadata?: {
    notes?: string;
    core_conflict_trigger?: boolean;
    safety_buffer_breach?: boolean;
    invoice_no?: string;
  };
}

export default function CashAgentHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("kbank");
  const [isBankConnected, setIsBankConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summaryData, setSummaryData] = useState<FinancialSummaryData | null>(null);

  // Safety Buffer in-memory override (Sheet / Modal)
  const [customBuffer, setCustomBuffer] = useState<number | null>(null);
  const [isBufferModalOpen, setIsBufferModalOpen] = useState<boolean>(false);
  const [bufferPresetChoice, setBufferPresetChoice] = useState<number>(80000);
  const [bufferToast, setBufferToast] = useState<string | null>(null);

  // Selected Week Detail (Sheet / Modal)
  const [selectedWeek, setSelectedWeek] = useState<WeekForecast | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(2); // Default to Week 3 (critical week)
  const [isWeekDetailOpen, setIsWeekDetailOpen] = useState<boolean>(false);
  const [weekTransactions, setWeekTransactions] = useState<StatementTransaction[]>([]);
  const [isLoadingWeekTxns, setIsLoadingWeekTxns] = useState<boolean>(false);

  // What-If Scenario Toggles (In-memory stress test per instruction.md)
  const [scenarioDebtorLate, setScenarioDebtorLate] = useState<boolean>(false); // Boutique Siam / key debtor pays 3 weeks late
  const [scenarioPlatformHold, setScenarioPlatformHold] = useState<boolean>(false); // TikTok/Platforms hold payouts 7 days
  const [scenarioExtraInventory, setScenarioExtraInventory] = useState<boolean>(false); // Order ฿100k extra inventory
  const [scenarioToast, setScenarioToast] = useState<string | null>(null);

  // Check auth session
  useEffect(() => {
    const session = getSession();
    if (session?.user) {
      setUser(session.user);
    }
  }, []);

  // Bank Connection & Storage Sync
  const checkBankConnection = () => {
    if (typeof window === "undefined") return;
    const connected = localStorage.getItem("bizmate_bank_connected") !== "false";
    const storedBank = localStorage.getItem("bizmate_selected_bank") || "kbank";
    setIsBankConnected(connected);
    setSelectedBankId(storedBank);
  };

  useEffect(() => {
    checkBankConnection();
    const handleStorage = () => checkBankConnection();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("bizmate_bank_changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("bizmate_bank_changed", handleStorage);
    };
  }, []);

  // Fetch summary data when bank changes
  const fetchSummary = async (bankId: string) => {
    setIsLoading(true);
    try {
      // Check multi-bank settings
      let queryParam = `bankId=${encodeURIComponent(bankId)}`;
      if (typeof window !== "undefined") {
        const storedMulti = localStorage.getItem("bizmate_active_bank_ids");
        if (storedMulti) {
          try {
            const parsed = JSON.parse(storedMulti);
            if (Array.isArray(parsed) && parsed.length > 0) {
              queryParam = `bankIds=${encodeURIComponent(parsed.join(","))}`;
            }
          } catch {
            // ignore
          }
        }
      }

      const res = await fetch(`/api/financial/summary?${queryParam}`);
      if (!res.ok) throw new Error("Failed to load summary");
      const data: FinancialSummaryData = await res.json();
      setSummaryData(data);
      // Initialize preset buffer choice
      setBufferPresetChoice(data.safetyBuffer || 80000);
      // Set default selected week
      if (data.cashRadarWeeks && data.cashRadarWeeks.length > 2) {
        setSelectedWeek(data.cashRadarWeeks[2]);
        setSelectedWeekIndex(2);
      } else if (data.cashRadarWeeks && data.cashRadarWeeks.length > 0) {
        setSelectedWeek(data.cashRadarWeeks[0]);
        setSelectedWeekIndex(0);
      }
    } catch (err) {
      console.error("Error fetching financial summary for Cash Agent:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isBankConnected) {
      fetchSummary(selectedBankId);
    } else {
      setIsLoading(false);
    }
  }, [selectedBankId, isBankConnected]);

  // Current active buffer threshold
  const activeBuffer = customBuffer !== null ? customBuffer : (summaryData?.safetyBuffer || 80000);

  // Compute 13-week forecast with What-if stress testing mutations (Purely in-memory)
  const computedWeeks = useMemo(() => {
    if (!summaryData?.cashRadarWeeks) return [];

    // Clone base weeks
    const baseWeeks: WeekForecast[] = summaryData.cashRadarWeeks.map((w) => ({ ...w }));

    // Dynamic adjustments
    // Scenario 1: Key debtor pays 3 weeks late -> Shift inflow of ~฿35k/48k from W1/W2 to W4/W5
    const debtorAmount = summaryData.buyerHabits?.[0]?.currentOverdueAmount || 35000;

    // Scenario 2: TikTok / platform hold payouts for 7 days -> Shift ~฿30k from W2 to W3 or W3 to W4
    const platformHoldAmt = 30000;

    // Scenario 3: Order ฿100k extra inventory in Week 2 -> Outflow increases by ฿100k in W2
    const inventoryExtraAmt = 100000;

    let runningBalance = summaryData.currentCashToday;

    return baseWeeks.map((w, idx) => {
      let modifiedInflow = w.inflow;
      let modifiedOutflow = w.outflow;
      let extraNotes: string[] = [];

      // Apply Scenario 1 (Debtor pays 3 weeks late)
      if (scenarioDebtorLate) {
        if (idx === 0) {
          modifiedInflow = Math.max(0, modifiedInflow - debtorAmount);
          extraNotes.push(`Debtor delay (-฿${(debtorAmount / 1000).toFixed(0)}k shifted)`);
        } else if (idx === 3) {
          modifiedInflow += debtorAmount;
          extraNotes.push(`Delayed AR recovered (+฿${(debtorAmount / 1000).toFixed(0)}k)`);
        }
      }

      // Apply Scenario 2 (Platform holds 7 days)
      if (scenarioPlatformHold) {
        if (idx === 1) {
          modifiedInflow = Math.max(0, modifiedInflow - platformHoldAmt);
          extraNotes.push(`Platform hold (-฿${(platformHoldAmt / 1000).toFixed(0)}k)`);
        } else if (idx === 2) {
          modifiedInflow += platformHoldAmt;
          extraNotes.push(`Held payouts released (+฿${(platformHoldAmt / 1000).toFixed(0)}k)`);
        }
      }

      // Apply Scenario 3 (Order ฿100k extra inventory)
      if (scenarioExtraInventory) {
        if (idx === 1) {
          modifiedOutflow += inventoryExtraAmt;
          extraNotes.push(`Extra inventory order (-฿${(inventoryExtraAmt / 1000).toFixed(0)}k)`);
        }
      }

      // Calculate running closing balance
      if (idx === 0) {
        // First week: balance from current cash today + net
        runningBalance = summaryData.currentCashToday + modifiedInflow - modifiedOutflow;
      } else {
        runningBalance = runningBalance + modifiedInflow - modifiedOutflow;
      }

      const bal = Math.round(runningBalance);

      let status: "safe" | "below" | "short" = "safe";
      if (bal <= 0) {
        status = "short";
      } else if (bal < activeBuffer) {
        status = "below";
      }

      // Preserve base note if present, append scenario tags
      let finalNote = w.note;
      if (extraNotes.length > 0) {
        finalNote = (finalNote ? `${finalNote} • ` : "") + extraNotes.join(", ");
      }

      // Recalculate bar height
      const heightPercent = Math.min(100, Math.max(16, Math.round((bal / Math.max(350000, activeBuffer * 2.2)) * 100)));

      return {
        ...w,
        balance: bal,
        inflow: Math.round(modifiedInflow),
        outflow: Math.round(modifiedOutflow),
        status,
        heightPercent,
        note: finalNote,
      };
    });
  }, [
    summaryData,
    activeBuffer,
    scenarioDebtorLate,
    scenarioPlatformHold,
    scenarioExtraInventory,
  ]);

  // Update selected week when computedWeeks recalculate
  useEffect(() => {
    if (computedWeeks.length > selectedWeekIndex) {
      setSelectedWeek(computedWeeks[selectedWeekIndex]);
    }
  }, [computedWeeks, selectedWeekIndex]);

  // Load itemized transactions for a week when inspecting week detail
  const handleOpenWeekDetail = async (week: WeekForecast, index: number) => {
    setSelectedWeek(week);
    setSelectedWeekIndex(index);
    setIsWeekDetailOpen(true);
    setIsLoadingWeekTxns(true);

    try {
      const res = await fetch(
        `/api/financial/transactions?bankId=${encodeURIComponent(selectedBankId)}&limit=100`
      );
      if (res.ok) {
        const data = await res.json();
        // Filter transactions within week dates
        const txns: StatementTransaction[] = (data.transactions || []).filter(
          (t: StatementTransaction) => {
            const dateStr = t.datetime.split("T")[0];
            return dateStr >= week.startDate && dateStr <= week.endDate;
          }
        );
        setWeekTransactions(txns);
      }
    } catch (err) {
      console.error("Failed to fetch week transactions:", err);
    } finally {
      setIsLoadingWeekTxns(false);
    }
  };

  // Switch Bank
  const handleSwitchBank = (bankId: string) => {
    setSelectedBankId(bankId);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_selected_bank", bankId);
      window.dispatchEvent(new Event("bizmate_bank_changed"));
    }
  };

  // Preset buffer apply
  const handleApplyBuffer = (newBuffer: number) => {
    setCustomBuffer(newBuffer);
    setIsBufferModalOpen(false);
    setBufferToast(`Safety buffer threshold dynamically updated to ฿${newBuffer.toLocaleString()}! 13-Week Cash Radar recomputed.`);
    setTimeout(() => setBufferToast(null), 4500);
  };

  // Reset what-if scenarios
  const handleResetScenarios = () => {
    setScenarioDebtorLate(false);
    setScenarioPlatformHold(false);
    setScenarioExtraInventory(false);
    setScenarioToast("What-if scenarios reset to baseline ledger forecast.");
    setTimeout(() => setScenarioToast(null), 3000);
  };

  // Find lowest cash week
  const lowestWeek = useMemo(() => {
    if (computedWeeks.length === 0) return null;
    let minW = computedWeeks[0];
    computedWeeks.forEach((w) => {
      if (w.balance < minW.balance) minW = w;
    });
    return minW;
  }, [computedWeeks]);

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
            <span className="text-sky-600 dark:text-sky-400 font-bold">
              Cash Radar &amp; Liquidity Hub
            </span>
          </div>

          {/* Connected Bank Switcher */}
          {isBankConnected && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
                Operating Rail:
              </span>
              <select
                value={selectedBankId}
                onChange={(e) => handleSwitchBank(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer shadow-xs"
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
            <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              🔒
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 inline-block mb-3">
              Bank Connection Required
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Cash Radar &amp; Liquidity Hub Locked
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-md mx-auto">
              To project 13-week rolling liquidity, calibrate safety buffer thresholds, and simulate what-if stress tests, please connect or select an operating bank account first.
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
            {bufferToast && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>🛡️</span>
                  <span>{bufferToast}</span>
                </div>
                <button
                  onClick={() => setBufferToast(null)}
                  className="text-emerald-600 dark:text-emerald-400 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {scenarioToast && (
              <div className="mb-4 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>🧪</span>
                  <span>{scenarioToast}</span>
                </div>
                <button
                  onClick={() => setScenarioToast(null)}
                  className="text-sky-600 dark:text-sky-400 p-1 cursor-pointer"
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
                    {/* Animated agent avatar (gentle vertical bobbing animation) */}
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center text-2xl font-bold animate-bounce shadow-xs">
                      📊
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          Cash Agent
                        </h1>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                          Radar Live
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        13-Week Cash Radar, Rolling Buffer Projections &amp; What-If Stress-Testing
                      </p>
                    </div>
                  </div>

                  {/* Speech Bubble Context */}
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">💬</span>
                    <div>
                      <strong className="text-sky-800 dark:text-sky-300 font-semibold">
                        Cash Agent Telemetry Feed:
                      </strong>{" "}
                      Tracking rolling liquidity for <strong>{summaryData?.company || "Your SME"}</strong>. Safety buffer calibrated at <strong>฿{activeBuffer.toLocaleString()}</strong>.
                      {lowestWeek && lowestWeek.status !== "safe" ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium ml-1">
                          ⚠️ Critical liquidity drop flagged on {lowestWeek.week} ({lowestWeek.date}) at ฿{lowestWeek.balance.toLocaleString()}.
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium ml-1">
                          ✓ Rolling balance remains healthy above safety buffer across all 13 weeks.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational Boundaries */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span><strong>Does on its own:</strong> Ingests bank &amp; sales feeds; computes daily rolling cash balances.</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span><strong>Asks you first:</strong> Adjusting cash reserve buffer threshold.</span>
                    </div>
                  </div>

                  {/* Data Lineage Footer */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-3 text-[10px] font-mono text-slate-400">
                    <span>Uses {summaryData?.bankName || "Linked Statement Feed"}</span>
                    <span>•</span>
                    <span>Updated 12 Oct 2026, 09:41 AM ICT</span>
                  </div>
                </div>

                {/* Quick Buffer Actions Pill */}
                <div className="flex flex-col gap-2.5 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Operating Cash Today</span>
                    <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                      {summaryData?.formattedCurrentCash || "฿0"}
                    </span>
                  </div>
                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Safety Buffer</span>
                    <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                      ฿{activeBuffer.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsBufferModalOpen(true)}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>⚙️ Adjust Safety Buffer</span>
                  </button>
                </div>
              </div>
            </div>

            {/* WHAT-IF INTERACTIVE SCENARIOS (instruction.md: CR-01 What-if Chips) */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧪</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Interactive What-If Stress Scenarios
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    In-Memory Simulation (Safe)
                  </span>
                </div>
                {(scenarioDebtorLate || scenarioPlatformHold || scenarioExtraInventory) && (
                  <button
                    onClick={handleResetScenarios}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>↺ Reset to baseline forecast</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5">
                Toggle hypothetical operational events to stress-test your liquidity without affecting actual ledger entries.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Chip 1: Debtor pays late */}
                <button
                  onClick={() => {
                    setScenarioDebtorLate((prev) => !prev);
                    setScenarioToast(!scenarioDebtorLate ? "Scenario active: Key debtor pays 3 weeks late (Inflow shifted to W4)." : "Scenario disabled.");
                  }}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
                    scenarioDebtorLate
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{scenarioDebtorLate ? "✓" : "+"}</span>
                  <span>Boutique Siam / Key Debtor pays 3 weeks late</span>
                  <span className="text-[10px] font-mono opacity-80">(~฿35k delay)</span>
                </button>

                {/* Chip 2: TikTok holds payout */}
                <button
                  onClick={() => {
                    setScenarioPlatformHold((prev) => !prev);
                    setScenarioToast(!scenarioPlatformHold ? "Scenario active: Platform holds payouts for 7 days (Shifted to W3)." : "Scenario disabled.");
                  }}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
                    scenarioPlatformHold
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{scenarioPlatformHold ? "✓" : "+"}</span>
                  <span>TikTok Shop / Platforms hold payouts for 7 days</span>
                  <span className="text-[10px] font-mono opacity-80">(~฿30k hold)</span>
                </button>

                {/* Chip 3: Order ฿100k extra inventory */}
                <button
                  onClick={() => {
                    setScenarioExtraInventory((prev) => !prev);
                    setScenarioToast(!scenarioExtraInventory ? "Scenario active: Order ฿100k extra inventory in W2 (Outflow injected)." : "Scenario disabled.");
                  }}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
                    scenarioExtraInventory
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{scenarioExtraInventory ? "✓" : "+"}</span>
                  <span>Order ฿100k extra inventory</span>
                  <span className="text-[10px] font-mono opacity-80">(-฿100k Outflow in W2)</span>
                </button>
              </div>
            </div>

            {/* CASH RADAR COMPONENT (instruction.md: CR-01 13-week bar chart) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white border border-slate-800 shadow-2xl mb-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                      13-Week Cash Radar Forecast
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      (Click any bar to inspect itemized cash flows)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Operating Safety Buffer: <strong className="font-mono text-white">฿{activeBuffer.toLocaleString()}</strong>
                  </p>
                </div>

                {/* Legend Chips */}
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Safe (&ge; Buffer)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Below Buffer
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Short (&le; 0)
                  </span>
                </div>
              </div>

              {/* 13-Week Bars Grid */}
              <div className="grid grid-cols-13 gap-1.5 sm:gap-2.5 h-44 items-end bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/10 backdrop-blur-xs my-3">
                {computedWeeks.map((w, idx) => {
                  const isFocus = selectedWeekIndex === idx;
                  const barColor =
                    w.status === "below"
                      ? "bg-amber-400 hover:bg-amber-300"
                      : w.status === "short"
                      ? "bg-rose-500 hover:bg-rose-400"
                      : "bg-sky-400 hover:bg-sky-300";

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
                          isFocus ? "font-bold text-white" : "text-slate-400 group-hover:text-white"
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
                <div className="p-4 rounded-2xl bg-black/50 border border-white/15 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-slate-900 px-2.5 py-0.5 rounded bg-white text-xs">
                      {selectedWeek.week} ({selectedWeek.date})
                    </span>
                    <span className="text-slate-200">
                      Projected Closing Cash:{" "}
                      <strong className={`font-mono text-sm ${
                        selectedWeek.status === "below" ? "text-amber-300" : selectedWeek.status === "short" ? "text-rose-400" : "text-sky-300"
                      }`}>
                        ฿{selectedWeek.balance.toLocaleString()}
                      </strong>
                    </span>
                    {selectedWeek.note && (
                      <span className="text-amber-300 font-semibold flex items-center gap-1">
                        ⚠️ {selectedWeek.note}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-[11px] font-mono text-slate-300 flex items-center gap-3">
                      <span className="text-emerald-400">Inflow: +฿{selectedWeek.inflow.toLocaleString()}</span>
                      <span>•</span>
                      <span className="text-rose-400">Outflow: -฿{selectedWeek.outflow.toLocaleString()}</span>
                    </div>

                    <button
                      onClick={() => handleOpenWeekDetail(selectedWeek, selectedWeekIndex)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <span>Itemized Flows</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* LIQUIDITY ANALYSIS & RECOMMENDATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              {/* Card 1: Conflict & Buffer Diagnosis */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-bold">
                    ⚡
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Liquidity Gap Diagnosis
                  </h3>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  {lowestWeek && lowestWeek.status !== "safe" ? (
                    <>
                      Cash Agent flagged a projected balance breach in <strong>{lowestWeek.week} ({lowestWeek.date})</strong> dipping to <strong>฿{lowestWeek.balance.toLocaleString()}</strong>, which violates your <strong>฿{activeBuffer.toLocaleString()}</strong> operating safety buffer.
                    </>
                  ) : (
                    <>
                      All 13 projected weeks safely sustain rolling cash balances above the <strong>฿{activeBuffer.toLocaleString()}</strong> threshold. No mandatory financing intervention is required.
                    </>
                  )}
                </p>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Current Safety Buffer:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">฿{activeBuffer.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Lowest Projected Cash:</span>
                    <span className={`font-mono font-bold ${lowestWeek && lowestWeek.status !== "safe" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      ฿{lowestWeek ? lowestWeek.balance.toLocaleString() : "0"} ({lowestWeek?.week || "--"})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Capital Gap to Buffer:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {lowestWeek && lowestWeek.balance < activeBuffer
                        ? `฿${(activeBuffer - lowestWeek.balance).toLocaleString()} required`
                        : "฿0 (Surplus)"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Remedy Plan:</span>
                  <Link
                    href="/dashboard/plan"
                    className="font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Joint Remedy Plan</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {/* Card 2: Inter-Agent Inflow & Outflow Levers */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center text-sm font-bold">
                    🔄
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Agent Remediation Levers
                  </h3>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  The Cash Agent coordinates with fellow agents to restore liquidity buffers without resorting to predatory loans:
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-orange-700 dark:text-orange-400 block">
                        🔔 Collections Agent • Recover AR Inflow
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {summaryData?.buyerHabits?.[0]?.currentOverdueAmount
                          ? `Collect ฿${summaryData.buyerHabits[0].currentOverdueAmount.toLocaleString()} from ${summaryData.buyerHabits[0].name}`
                          : "Maintain scheduled invoice collections"}
                      </span>
                    </div>
                    <Link
                      href="/dashboard/collections"
                      className="px-2.5 py-1 rounded-xl bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300 font-semibold text-[11px] hover:bg-orange-200 transition-colors"
                    >
                      AR Hub →
                    </Link>
                  </div>

                  <div className="p-3 rounded-2xl bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-900/40 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-yellow-700 dark:text-yellow-400 block">
                        💰 Funding Agent • 60-Day Terms Match
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {summaryData?.supplierHistory?.pendingOrderAmount
                          ? `Defer ${summaryData.supplierHistory.pendingOrderCurrency}${summaryData.supplierHistory.pendingOrderAmount.toLocaleString()} to preserve safety buffer`
                          : "Optimize working capital lines"}
                      </span>
                    </div>
                    <Link
                      href="/dashboard/plan"
                      className="px-2.5 py-1 rounded-xl bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-300 font-semibold text-[11px] hover:bg-yellow-200 transition-colors"
                    >
                      Plan →
                    </Link>
                  </div>

                  <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-rose-700 dark:text-rose-400 block">
                        🔍 True Cost Agent • Verified Payment Rail
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Zero hidden fees &amp; verified supplier registry locking
                      </span>
                    </div>
                    <Link
                      href="/dashboard/true-cost"
                      className="px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold text-[11px] hover:bg-rose-200 transition-colors"
                    >
                      Shield →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* SAFETY BUFFER SETTINGS MODAL (instruction.md: CR-01 Safety Buffer Settings Sheet) */}
      {isBufferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Safety Buffer Settings
                </h3>
              </div>
              <button
                onClick={() => setIsBufferModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              The Cash Agent uses your safety buffer to flag low-liquidity weeks before payroll, inventory, or operational expenses breach minimum reserves.
            </p>

            <div className="space-y-2.5">
              <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
                Preset Buffer Thresholds:
              </span>

              {[50000, 80000, 120000].map((preset) => (
                <div
                  key={preset}
                  onClick={() => setBufferPresetChoice(preset)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    bufferPresetChoice === preset
                      ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div>
                    <span className="text-sm font-bold font-mono">฿{preset.toLocaleString()}</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {preset === 50000 ? "Lean SME Reserve (~1.5 weeks fixed cost)" : preset === 80000 ? "Recommended Baseline (~3 weeks operating safety)" : "Conservative Buffer (~4.5 weeks cushion)"}
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="bufferChoice"
                    checked={bufferPresetChoice === preset}
                    onChange={() => setBufferPresetChoice(preset)}
                    className="accent-sky-600 w-4 h-4 cursor-pointer"
                  />
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsBufferModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyBuffer(bufferPresetChoice)}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                Save &amp; Redraw Forecast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEEK DETAIL SHEET (instruction.md: CR-01 Week Detail Sheet) */}
      {isWeekDetailOpen && selectedWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-xs">
                  {selectedWeek.week}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Week Cash Detail ({selectedWeek.date})
                </h3>
              </div>
              <button
                onClick={() => setIsWeekDetailOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Inflow vs Outflow KPI Bar */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs shrink-0">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Expected Inflow</span>
                <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  +฿{selectedWeek.inflow.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Expected Outflow</span>
                <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 block mt-0.5">
                  -฿{selectedWeek.outflow.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Ending Balance</span>
                <span className={`text-sm font-bold font-mono block mt-0.5 ${
                  selectedWeek.status === "below" ? "text-amber-600 dark:text-amber-400" : selectedWeek.status === "short" ? "text-rose-600 dark:text-rose-400" : "text-sky-600 dark:text-sky-400"
                }`}>
                  ฿{selectedWeek.balance.toLocaleString()}
                </span>
              </div>
            </div>

            {selectedWeek.note && (
              <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 shrink-0">
                <span>⚠️</span>
                <span><strong>Agent Flag:</strong> {selectedWeek.note}</span>
              </div>
            )}

            {/* Itemized Transactions List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block mb-1">
                Statement Telemetry &amp; Scheduled Inflows/Outflows:
              </span>

              {isLoadingWeekTxns ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <span>Loading itemized cash flows...</span>
                </div>
              ) : weekTransactions.length > 0 ? (
                weekTransactions.map((tx) => (
                  <div
                    key={tx.txn_id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {tx.counterparty_name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {tx.channel}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        {tx.datetime.replace("T", " ").slice(0, 16)} • {tx.category}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold block ${
                        tx.type === "CREDIT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {tx.type === "CREDIT" ? "+" : "-"}฿{tx.amount.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        Closing: ฿{tx.balance_after.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 text-center text-xs text-slate-500">
                  <span>No discrete single-day statement records in this projection window. Closing balance projected from weekly multichannel run-rate.</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setIsWeekDetailOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Close Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
