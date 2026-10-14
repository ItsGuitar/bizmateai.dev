"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";

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

export interface CustomScenario {
  id: string;
  name: string;
  type: "INFLOW" | "OUTFLOW";
  weekIndex: number; // 0 to 12
  weekLabel: string; // W1 to W13
  amount: number;
  isEnabled: boolean;
  isCustom?: boolean;
  createdAt?: string;
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

  // Baseline Preset Scenario Toggles (In-memory standard demo)
  const [scenarioDebtorLate, setScenarioDebtorLate] = useState<boolean>(false); // Boutique Siam / key debtor pays 3 weeks late
  const [scenarioPlatformHold, setScenarioPlatformHold] = useState<boolean>(false); // TikTok/Platforms hold payouts 7 days
  const [scenarioExtraInventory, setScenarioExtraInventory] = useState<boolean>(false); // Order ฿100k extra inventory
  const [scenarioToast, setScenarioToast] = useState<string | null>(null);

  // User-Created Dynamic What-If Scenarios (Persisted in PostgreSQL database via Prisma)
  const [customScenarios, setCustomScenarios] = useState<CustomScenario[]>([]);
  const [isAddScenarioModalOpen, setIsAddScenarioModalOpen] = useState<boolean>(false);
  const [isSavingScenario, setIsSavingScenario] = useState<boolean>(false);
  const [newScenarioName, setNewScenarioName] = useState<string>("");
  const [newScenarioType, setNewScenarioType] = useState<"INFLOW" | "OUTFLOW">("OUTFLOW");
  const [newScenarioWeek, setNewScenarioWeek] = useState<number>(2); // 0-indexed (W3 = 2)
  const [newScenarioAmount, setNewScenarioAmount] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

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

  // Fetch custom scenarios from database
  const fetchCustomScenarios = useCallback(async (bankId: string) => {
    const session = getSession();
    if (!session?.token) return;

    try {
      const res = await fetch(`/api/financial/what-if?bankId=${encodeURIComponent(bankId)}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scenarios) {
          setCustomScenarios(data.scenarios);
        }
      }
    } catch (err) {
      console.error("Failed to load custom what-if scenarios from DB:", err);
    }
  }, []);

  // Fetch summary data when bank changes
  const fetchSummary = useCallback(async (bankId: string) => {
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

      // Also load custom scenarios for this bank
      await fetchCustomScenarios(bankId);
    } catch (err) {
      console.error("Error fetching financial summary for Cash Agent:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCustomScenarios]);

  useEffect(() => {
    if (isBankConnected) {
      fetchSummary(selectedBankId);
    } else {
      setIsLoading(false);
    }
  }, [selectedBankId, isBankConnected, fetchSummary]);

  // Current active buffer threshold
  const activeBuffer = customBuffer !== null ? customBuffer : (summaryData?.safetyBuffer || 80000);

  // Compute 13-week forecast with What-if stress testing mutations (In-memory real-time application)
  const computedWeeks = useMemo(() => {
    if (!summaryData?.cashRadarWeeks) return [];

    // Clone base weeks
    const baseWeeks: WeekForecast[] = summaryData.cashRadarWeeks.map((w) => ({ ...w }));

    // Dynamic adjustments
    // Preset Scenario 1: Key debtor pays 3 weeks late
    const debtorAmount = summaryData.buyerHabits?.[0]?.currentOverdueAmount || 35000;
    // Preset Scenario 2: TikTok / platform hold payouts for 7 days
    const platformHoldAmt = 30000;
    // Preset Scenario 3: Order ฿100k extra inventory in Week 2
    const inventoryExtraAmt = 100000;

    let runningBalance = summaryData.currentCashToday;

    return baseWeeks.map((w, idx) => {
      let modifiedInflow = w.inflow;
      let modifiedOutflow = w.outflow;
      let extraNotes: string[] = [];

      // 1. Preset Scenario 1 (Debtor pays 3 weeks late)
      if (scenarioDebtorLate) {
        if (idx === 0) {
          modifiedInflow = Math.max(0, modifiedInflow - debtorAmount);
          extraNotes.push(`Debtor delay (-฿${(debtorAmount / 1000).toFixed(0)}k shifted)`);
        } else if (idx === 3) {
          modifiedInflow += debtorAmount;
          extraNotes.push(`Delayed AR recovered (+฿${(debtorAmount / 1000).toFixed(0)}k)`);
        }
      }

      // 2. Preset Scenario 2 (Platform holds 7 days)
      if (scenarioPlatformHold) {
        if (idx === 1) {
          modifiedInflow = Math.max(0, modifiedInflow - platformHoldAmt);
          extraNotes.push(`Platform hold (-฿${(platformHoldAmt / 1000).toFixed(0)}k)`);
        } else if (idx === 2) {
          modifiedInflow += platformHoldAmt;
          extraNotes.push(`Held payouts released (+฿${(platformHoldAmt / 1000).toFixed(0)}k)`);
        }
      }

      // 3. Preset Scenario 3 (Order ฿100k extra inventory)
      if (scenarioExtraInventory) {
        if (idx === 1) {
          modifiedOutflow += inventoryExtraAmt;
          extraNotes.push(`Extra inventory order (-฿${(inventoryExtraAmt / 1000).toFixed(0)}k)`);
        }
      }

      // 4. Custom User-Created Scenarios (Active & applied to this specific week)
      customScenarios.forEach((sc) => {
        if (sc.isEnabled && sc.weekIndex === idx) {
          const formattedAmt = sc.amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
          if (sc.type === "INFLOW") {
            modifiedInflow += sc.amount;
            extraNotes.push(`${sc.name} (+฿${formattedAmt})`);
          } else {
            modifiedOutflow += sc.amount;
            extraNotes.push(`${sc.name} (-฿${formattedAmt})`);
          }
        }
      });

      // Calculate running closing balance
      if (idx === 0) {
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
    customScenarios,
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
    if (typeof window !== "undefined") {
      localStorage.setItem(`bizmate_custom_buffer_${selectedBankId}`, String(newBuffer));
      window.dispatchEvent(new Event("bizmate_bank_changed"));
    }
    setBufferToast(`Safety buffer threshold dynamically updated to ฿${newBuffer.toLocaleString()}! 13-Week Cash Radar recomputed.`);
    setTimeout(() => setBufferToast(null), 4500);
  };

  // Reset all scenarios (both presets and custom toggles)
  const handleResetScenarios = () => {
    setScenarioDebtorLate(false);
    setScenarioPlatformHold(false);
    setScenarioExtraInventory(false);
    // Turn off all custom scenarios in-memory
    setCustomScenarios((prev) => prev.map((s) => ({ ...s, isEnabled: false })));
    setScenarioToast("All what-if stress scenarios reset to baseline ledger forecast.");
    setTimeout(() => setScenarioToast(null), 3500);
  };

  // Toggle custom scenario active state (persisted via PATCH)
  const handleToggleCustomScenario = async (id: string, currentState: boolean) => {
    const nextState = !currentState;
    // Optimistic UI update
    setCustomScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isEnabled: nextState } : s))
    );

    const session = getSession();
    if (session?.token) {
      try {
        await fetch("/api/financial/what-if", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ id, isEnabled: nextState }),
        });
      } catch (err) {
        console.error("Failed to patch scenario state:", err);
      }
    }
  };

  // Delete custom scenario (persisted via DELETE)
  const handleDeleteCustomScenario = async (id: string, name: string) => {
    // Optimistic remove
    setCustomScenarios((prev) => prev.filter((s) => s.id !== id));
    setScenarioToast(`Deleted scenario "${name}" from database.`);
    setTimeout(() => setScenarioToast(null), 3500);

    const session = getSession();
    if (session?.token) {
      try {
        await fetch(`/api/financial/what-if?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.token}` },
        });
      } catch (err) {
        console.error("Failed to delete scenario from DB:", err);
      }
    }
  };

  // Add new scenario (persisted via POST)
  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newScenarioName.trim()) {
      setFormError("Please enter a descriptive scenario name.");
      return;
    }

    const amountNum = parseFloat(newScenarioAmount.replace(/,/g, ""));
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Please enter a valid positive number for amount.");
      return;
    }

    const session = getSession();
    if (!session?.token) {
      setFormError("Authentication session expired. Please sign in again.");
      return;
    }

    setIsSavingScenario(true);
    try {
      const res = await fetch("/api/financial/what-if", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          bankId: selectedBankId,
          name: newScenarioName.trim(),
          type: newScenarioType,
          weekIndex: newScenarioWeek,
          amount: amountNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create scenario");
      }

      // Add to state and close modal
      setCustomScenarios((prev) => [...prev, data.scenario]);
      setIsAddScenarioModalOpen(false);
      setNewScenarioName("");
      setNewScenarioAmount("");
      setNewScenarioWeek(2);
      setScenarioToast(`Created and applied scenario "${data.scenario.name}" to W${data.scenario.weekIndex + 1}!`);
      setTimeout(() => setScenarioToast(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save scenario";
      setFormError(msg);
    } finally {
      setIsSavingScenario(false);
    }
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
                    {/* Animated agent avatar */}
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xl font-bold animate-bounce shadow-xs">
                      📊
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                          Cash Agent
                        </h1>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                          Radar Live
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        13-Week Cash Radar &amp; Liquidity Simulation
                      </p>
                    </div>
                  </div>

                  {/* Speech Bubble Context - Friendly & Crisp */}
                  <div className="mt-3 p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
                    <span className="text-base shrink-0">💬</span>
                    <div>
                      <span>Buffer: <strong>฿{activeBuffer.toLocaleString()}</strong>.</span>{" "}
                      {lowestWeek && lowestWeek.status !== "safe" ? (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          Low cash alert on {lowestWeek.week} ({lowestWeek.date}) at ฿{lowestWeek.balance.toLocaleString()}.
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Cash flow is healthy across all 13 weeks.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational Boundaries */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span><strong>Auto:</strong> Tracks rolling daily cash</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span><strong>Approvals:</strong> Buffer changes require your OK</span>
                    </div>
                  </div>
                </div>

                {/* Quick Buffer Actions Pill */}
                <div className="flex flex-col gap-2 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 min-w-[210px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] text-slate-400 font-medium">Cash Today</span>
                    <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                      {summaryData?.formattedCurrentCash || "฿0"}
                    </span>
                  </div>
                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] text-slate-400 font-medium">Safety Buffer</span>
                    <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                      ฿{activeBuffer.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsBufferModalOpen(true)}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>⚙️ Adjust Buffer</span>
                  </button>
                </div>
              </div>
            </div>

            {/* WHAT-IF INTERACTIVE SCENARIOS */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧪</span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    What-If Scenarios
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {(scenarioDebtorLate || scenarioPlatformHold || scenarioExtraInventory || customScenarios.some((s) => s.isEnabled)) && (
                    <button
                      onClick={handleResetScenarios}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1 mr-1"
                    >
                      <span>↺ Reset</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFormError(null);
                      setIsAddScenarioModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <span>+ New Scenario</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5">
                Simulate cash flow changes to see if your buffer holds.
              </p>

              {/* Baseline Presets Group */}
              <div className="mb-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Preset 1: Debtor pays late */}
                  <button
                    onClick={() => {
                      setScenarioDebtorLate((prev) => !prev);
                      setScenarioToast(!scenarioDebtorLate ? "Debtor delay simulated (shifted to W4)." : "Scenario off.");
                    }}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                      scenarioDebtorLate
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{scenarioDebtorLate ? "✓" : "+"}</span>
                    <span>Debtor pays 3 weeks late</span>
                    <span className="text-[10px] opacity-75">(~฿35k)</span>
                  </button>

                  {/* Preset 2: TikTok holds payout */}
                  <button
                    onClick={() => {
                      setScenarioPlatformHold((prev) => !prev);
                      setScenarioToast(!scenarioPlatformHold ? "Platform payout hold simulated (shifted to W3)." : "Scenario off.");
                    }}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                      scenarioPlatformHold
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{scenarioPlatformHold ? "✓" : "+"}</span>
                    <span>Platforms hold payouts 7 days</span>
                    <span className="text-[10px] opacity-75">(~฿30k)</span>
                  </button>

                  {/* Preset 3: Order ฿100k extra inventory */}
                  <button
                    onClick={() => {
                      setScenarioExtraInventory((prev) => !prev);
                      setScenarioToast(!scenarioExtraInventory ? "Extra inventory order simulated in W2." : "Scenario off.");
                    }}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                      scenarioExtraInventory
                        ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{scenarioExtraInventory ? "✓" : "+"}</span>
                    <span>Extra inventory order</span>
                    <span className="text-[10px] opacity-75">(-฿100k in W2)</span>
                  </button>
                </div>
              </div>

              {/* User Custom Scenarios List */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                    Custom Scenarios ({customScenarios.length})
                  </span>
                </div>

                {customScenarios.length === 0 ? (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <span>No custom scenarios yet.</span>
                    <button
                      onClick={() => {
                        setFormError(null);
                        setIsAddScenarioModalOpen(true);
                      }}
                      className="text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                    >
                      Create one →
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {customScenarios.map((sc) => {
                      const isOutflow = sc.type === "OUTFLOW";
                      return (
                        <div
                          key={sc.id}
                          className={`pl-3 pr-2 py-1.5 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 border ${
                            sc.isEnabled
                              ? isOutflow
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 shadow-xs"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 shadow-xs"
                              : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-60"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleCustomScenario(sc.id, sc.isEnabled)}
                            className="flex items-center gap-1.5 cursor-pointer text-left"
                            title={sc.isEnabled ? "Click to disable" : "Click to activate"}
                          >
                            <span className="text-sm font-bold">
                              {sc.isEnabled ? "✓" : "○"}
                            </span>
                            <span>{sc.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/70 dark:bg-black/40">
                              {sc.weekLabel}: {isOutflow ? "-" : "+"}฿{sc.amount.toLocaleString()}
                            </span>
                          </button>

                          {/* Delete scenario button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomScenario(sc.id, sc.name);
                            }}
                            className="ml-1 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete scenario from database"
                            aria-label="Delete Scenario"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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

              {/* 13-Week Bars Grid with Horizontal Scroll on Phone */}
              <div className="overflow-x-auto pb-2 -mx-1 px-1 my-3">
                <div className="grid grid-cols-13 gap-2 min-w-[560px] sm:min-w-0 sm:gap-2.5 h-44 items-end bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/10 backdrop-blur-xs">
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

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  {lowestWeek && lowestWeek.status !== "safe" ? (
                    <>
                      Projected cash dips to <strong>฿{lowestWeek.balance.toLocaleString()}</strong> in <strong>{lowestWeek.week} ({lowestWeek.date})</strong>, below your ฿{activeBuffer.toLocaleString()} buffer.
                    </>
                  ) : (
                    <>
                      All 13 weeks maintain cash balances above your ฿{activeBuffer.toLocaleString()} buffer.
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

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Suggested steps across agents to protect your liquidity buffer:
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

      {/* CREATE NEW WHAT-IF SCENARIO MODAL (User-Added Scenarios Persisted in PostgreSQL) */}
      {isAddScenarioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧪</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add What-If Stress Scenario
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddScenarioModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateScenario} className="space-y-4">
              {/* Field 1: Scenario Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Scenario Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Marketing Campaign, New Machine Downpayment, Big Retail Order"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  required
                />
              </div>

              {/* Field 2: Flow Type (Inflow vs Outflow) */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Cash Flow Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewScenarioType("OUTFLOW")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      newScenarioType === "OUTFLOW"
                        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>💸 Outflow (Expense / Delay)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewScenarioType("INFLOW")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      newScenarioType === "INFLOW"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>💰 Inflow (Revenue / Grant)</span>
                  </button>
                </div>
              </div>

              {/* Field 3: Target Week (W1 to W13) */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Week (W1 - W13)
                </label>
                <select
                  value={newScenarioWeek}
                  onChange={(e) => setNewScenarioWeek(Number(e.target.value))}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
                >
                  {computedWeeks.map((w, idx) => (
                    <option key={w.week} value={idx}>
                      {w.week} ({w.date}) - Baseline Bal: ฿{w.balance.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 4: Amount */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Amount in THB (฿) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-mono text-slate-400">
                    ฿
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="e.g. 25450, 18500.50, 100000"
                    value={newScenarioAmount}
                    onChange={(e) => setNewScenarioAmount(e.target.value)}
                    className="w-full text-xs font-mono pl-8 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                  Quick amounts:{" "}
                  <button
                    type="button"
                    onClick={() => setNewScenarioAmount("30000")}
                    className="text-sky-600 hover:underline cursor-pointer mr-1.5"
                  >
                    ฿30k
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewScenarioAmount("50000")}
                    className="text-sky-600 hover:underline cursor-pointer mr-1.5"
                  >
                    ฿50k
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewScenarioAmount("100000")}
                    className="text-sky-600 hover:underline cursor-pointer mr-1.5"
                  >
                    ฿100k
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewScenarioAmount("200000")}
                    className="text-sky-600 hover:underline cursor-pointer"
                  >
                    ฿200k
                  </button>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddScenarioModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingScenario}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSavingScenario ? "Saving to Database..." : "Save & Simulate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                type="button"
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
                type="button"
                onClick={() => setIsBufferModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
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
                type="button"
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
                type="button"
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
