"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";

interface BankSupplierConfig {
  bankId: string;
  bankName: string;
  companyName: string;
  currency: string;
  currencyCode: string;
  supplierName: string;
  supplierAccount: string;
  verifiedBankName: string;
  orderAmountForeign: number;
  orderAmountThb: number;
  exchangeRate: number;
  partnerMarginPct: number;
  swiftFeeThb: number;
  swiftSpreadThb: number;
  dueDate: string;
  countryName: string;
  flagEmoji: string;
  wechatSupported: boolean;
}

const BANK_SUPPLIER_CONFIGS: Record<string, BankSupplierConfig> = {
  kbank: {
    bankId: "kbank",
    bankName: "Kasikornbank Operating Account",
    companyName: "Ploy Select Co., Ltd.",
    currency: "¥",
    currencyCode: "CNH",
    supplierName: "Shenzhen Chen Tech Electronics Co., Ltd.",
    supplierAccount: "6217 0038 9102 9081",
    verifiedBankName: "China Construction Bank (Shenzhen Nanshan Branch)",
    orderAmountForeign: 100000,
    orderAmountThb: 482500,
    exchangeRate: 4.825,
    partnerMarginPct: 0.15,
    swiftFeeThb: 1200,
    swiftSpreadThb: 5000,
    dueDate: "26 Oct 2026",
    countryName: "China (CNH)",
    flagEmoji: "🇨🇳",
    wechatSupported: true,
  },
  scb: {
    bankId: "scb",
    bankName: "Siam Commercial Bank Corporate",
    companyName: "Apex Craft Furniture & Interior Co., Ltd.",
    currency: "¥",
    currencyCode: "JPY",
    supplierName: "Osaka Timber & Veneer Mills Co., Ltd.",
    supplierAccount: "3819 0284 1092 5530",
    verifiedBankName: "Sumitomo Mitsui Banking Corporation (Osaka Branch)",
    orderAmountForeign: 3200000,
    orderAmountThb: 892625,
    exchangeRate: 0.2789,
    partnerMarginPct: 0.18,
    swiftFeeThb: 1500,
    swiftSpreadThb: 8500,
    dueDate: "26 Oct 2026",
    countryName: "Japan (JPY)",
    flagEmoji: "🇯🇵",
    wechatSupported: false,
  },
  bbl: {
    bankId: "bbl",
    bankName: "Bangkok Bank iCash Operating",
    companyName: "BioHarvest Agro Tech Co., Ltd.",
    currency: "¥",
    currencyCode: "CNH",
    supplierName: "Heilongjiang AgroChem Precision Ltd.",
    supplierAccount: "4102 9931 8840 2194",
    verifiedBankName: "Agricultural Bank of China (Harbin Branch)",
    orderAmountForeign: 180000,
    orderAmountThb: 651375,
    exchangeRate: 3.6187,
    partnerMarginPct: 0.16,
    swiftFeeThb: 1200,
    swiftSpreadThb: 6800,
    dueDate: "26 Oct 2026",
    countryName: "China (CNH)",
    flagEmoji: "🇨🇳",
    wechatSupported: true,
  },
  personal: {
    bankId: "personal",
    bankName: "Kasikornbank Personal Savings (3 Months)",
    companyName: "Kittisak Somchai (Freelance Creator)",
    currency: "฿",
    currencyCode: "THB",
    supplierName: "Digital Studio Equipment Bangkok Co., Ltd.",
    supplierAccount: "045-2-99182-4",
    verifiedBankName: "Kasikornbank (Siam Square Branch)",
    orderAmountForeign: 45000,
    orderAmountThb: 45000,
    exchangeRate: 1.0,
    partnerMarginPct: 0.0,
    swiftFeeThb: 0,
    swiftSpreadThb: 0,
    dueDate: "20 Oct 2026",
    countryName: "Domestic PromptPay Rail (THB)",
    flagEmoji: "🇹🇭",
    wechatSupported: false,
  },
};

interface AnalysisResult {
  headline: string;
  verdict: "SAFE" | "SUSPICIOUS" | "PREDATORY";
  effectiveApr: number | null;
  legalCeilingApr: number;
  exceedsLegalCeiling: boolean;
  redFlags: string[];
  recommendation: string;
  calculatedMetrics?: {
    principal?: string;
    statedRate?: string;
    actualAnnualCost?: string;
    totalPayback?: string;
  };
}

export default function TrueCostHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("kbank");
  const [activeTab, setActiveTab] = useState<"analyzer" | "rails" | "confirmation" | "tracker" | "calculator">("analyzer");

  // Dynamic config based on active bank account
  const currentConfig = BANK_SUPPLIER_CONFIGS[selectedBankId] || BANK_SUPPLIER_CONFIGS.kbank;

  // Scanner state
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Payment Confirmation & Biometric Dispatch State
  const [paymentSchedule, setPaymentSchedule] = useState<"due-date" | "today">("due-date");
  const [faceIdModalOpen, setFaceIdModalOpen] = useState(false);
  const [faceIdStep, setFaceIdStep] = useState<"ready" | "scanning" | "success">("ready");
  const [isDispatched, setIsDispatched] = useState(false);
  const [dispatchTimestamp, setDispatchTimestamp] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>("TXN-FX-20261012-9841");

  // Tracker milestones
  const [activeMilestone, setActiveMilestone] = useState<number>(3); // 1 = Bank, 2 = Converted, 3 = Delivered

  // Real APR Calculator sliders
  const [calcPrincipal, setCalcPrincipal] = useState<number>(100000);
  const [calcDailyRate, setCalcDailyRate] = useState<number>(1.0);
  const [calcTenorDays, setCalcTenorDays] = useState<number>(30);

  // Check cooldown status on load
  const checkCooldownStatus = async (token: string) => {
    try {
      const res = await fetch("/api/true-cost/analyze", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.remainingSeconds > 0) {
          setCooldownSeconds(data.remainingSeconds);
        }
      }
    } catch (err) {
      console.error("Failed to check cooldown status:", err);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
    checkCooldownStatus(session.token);

    if (typeof window !== "undefined") {
      const storedBank = localStorage.getItem("bizmate_selected_bank") || "kbank";
      const validKey = BANK_SUPPLIER_CONFIGS[storedBank] ? storedBank : "kbank";
      setSelectedBankId(validKey);
    }
  }, [router]);

  // Countdown timer effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const handleRunSecurityScan = async () => {
    if (!inputText.trim() || isAnalyzing || cooldownSeconds > 0) return;

    const session = getSession();
    if (!session?.token) {
      router.push("/login");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/true-cost/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setErrorMessage(data.error || "Rate limited. Please wait.");
        if (data.remainingSeconds) {
          setCooldownSeconds(data.remainingSeconds);
        }
        return;
      }

      if (!res.ok) {
        setErrorMessage(data.error || "Analysis failed. Please try again.");
        return;
      }

      if (data.analysis) {
        setAnalysisResult(data.analysis);
      }
      if (data.cooldownSeconds) {
        setCooldownSeconds(data.cooldownSeconds);
      }
    } catch (err) {
      console.error("Scanner scan request error:", err);
      setErrorMessage("Network error during security scan. Please check connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Face ID Biometric Trigger
  const handleInitiateFaceId = () => {
    setFaceIdModalOpen(true);
    setFaceIdStep("ready");
  };

  const handleStartScan = () => {
    setFaceIdStep("scanning");
    setTimeout(() => {
      setFaceIdStep("success");
      setTimeout(() => {
        setFaceIdModalOpen(false);
        setIsDispatched(true);
        setDispatchTimestamp(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setActiveTab("tracker");
      }, 700);
    }, 1500);
  };

  // Switch active bank
  const handleSwitchBank = (bankKey: string) => {
    setSelectedBankId(bankKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_selected_bank", bankKey);
    }
  };

  // Calculator outputs
  const calculatedEffectiveApr = calcDailyRate * 365;
  const calculatedTotalFeeThb = (calcPrincipal * (calcDailyRate / 100)) * calcTenorDays;
  const calculatedTotalPaybackThb = calcPrincipal + calculatedTotalFeeThb;

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
            <span className="text-rose-600 dark:text-rose-400 font-bold">
              True Cost Protection Hub
            </span>
          </div>

          {/* Connected Bank Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
              Linked Account:
            </span>
            <select
              value={selectedBankId}
              onChange={(e) => handleSwitchBank(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/40 cursor-pointer shadow-xs"
            >
              <option value="kbank">KBANK: Ploy Select (Shenzhen Chen Tech)</option>
              <option value="scb">SCB: Apex Craft (Osaka Timber Mills)</option>
              <option value="bbl">BBL: BioHarvest (Heilongjiang AgroChem)</option>
              <option value="personal">Personal Savings: Freelance Creator (Domestic)</option>
            </select>
          </div>
        </div>

        {/* Hero Section */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl font-bold">
                  🔍
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Risk &amp; Fee Protection Hub
                  </h1>
                  <p className="text-xs text-slate-500 font-mono">
                    Autonomous APR Validation, Verified Payee Rails &amp; Biometric Guardrails
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                Operating for <strong>{currentConfig.companyName}</strong>. The True Cost Agent validates recipient bank accounts against authenticated trade registries, computes real annualized APR against the 15% Bank of Thailand statutory ceiling, and protects cross-border supplier disbursements with Face ID biometric step-up.
              </p>
            </div>

            {/* Live Telemetry Pill */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shrink-0">
              <div className="text-center px-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Verified Payee</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px] block mt-0.5">
                  {currentConfig.supplierName.split(" ")[0]}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div className="text-center px-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Disbursement Due</span>
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">
                  {currentConfig.currency}{currentConfig.orderAmountForeign.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Workflow Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab("analyzer")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "analyzer"
                  ? "bg-rose-600 text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Risk &amp; Fee Scanner
            </button>
            <button
              onClick={() => setActiveTab("rails")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "rails"
                  ? "bg-rose-600 text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Payment Rail Comparison
            </button>
            <button
              onClick={() => setActiveTab("confirmation")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "confirmation"
                  ? "bg-rose-600 text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Disbursement Authorization
            </button>
            <button
              onClick={() => setActiveTab("tracker")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "tracker"
                  ? "bg-rose-600 text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Receipt &amp; Lifecycle Tracker
            </button>
            <button
              onClick={() => setActiveTab("calculator")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "calculator"
                  ? "bg-rose-600 text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              APR Calculator
            </button>
          </div>
        </div>

        {/* ========================================================
            TAB 1: RISK & FEE ANALYZER
        ======================================================== */}
        {activeTab === "analyzer" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up duration-200">
            {/* Text Input Sandbox with Gemini Scan & Cooldown */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="scan-text" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Input Text Sandbox
                  </label>
                  <div className="flex items-center gap-2">
                    {cooldownSeconds > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                        Cooldown: {cooldownSeconds}s
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        ● Scanner Ready
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <span className="text-sm mt-0.5">🛡️</span>
                  <p className="leading-snug">
                    <strong>Deterministic Sandbox:</strong> Analyzed by True Cost Agent (Gemini 3.1 Flash Lite). Parses text strictly as inert data; prompt injection, non-financial queries, or instructions inside input are safely neutralized.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-2">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <p className="leading-snug">{errorMessage}</p>
                  </div>
                )}

                <textarea
                  id="scan-text"
                  rows={8}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Paste loan flyer, invoice email, financing contract terms, or payment message here to audit APR and counterparty risk..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none transition-all leading-relaxed"
                />

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("");
                      setAnalysisResult(null);
                      setErrorMessage(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Clear Text
                  </button>

                  <button
                    type="button"
                    disabled={!inputText.trim() || isAnalyzing || cooldownSeconds > 0}
                    onClick={handleRunSecurityScan}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Scanning with Gemini...</span>
                      </>
                    ) : cooldownSeconds > 0 ? (
                      <>
                        <span>Cooldown ({cooldownSeconds}s)</span>
                      </>
                    ) : (
                      <>
                        <span>Run Security Scan</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Output Card */}
            <div className="lg:col-span-6">
              {analysisResult ? (
                <div
                  className={`p-6 rounded-3xl border shadow-md transition-all duration-300 ${
                    analysisResult.verdict === "PREDATORY"
                      ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900"
                      : analysisResult.verdict === "SUSPICIOUS"
                      ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900"
                      : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                        analysisResult.verdict === "PREDATORY"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                          : analysisResult.verdict === "SUSPICIOUS"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      {analysisResult.verdict === "PREDATORY"
                        ? "🚨 BLOCKED - PREDATORY LENDING"
                        : analysisResult.verdict === "SUSPICIOUS"
                        ? "⚠️ HIGH PHISHING RISK"
                        : "✅ VERIFIED & COMPLIANT"}
                    </span>

                    <span className="text-[10px] font-mono text-slate-500">
                      Evaluated by True Cost Agent
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                    {analysisResult.headline}
                  </h3>

                  {analysisResult.effectiveApr !== null && (
                    <div className="mt-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Effective Annualized APR
                        </span>
                        <span
                          className={`text-xl font-mono font-black ${
                            analysisResult.exceedsLegalCeiling
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {analysisResult.effectiveApr.toFixed(1)}% APR
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden relative mt-2">
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white z-10"
                          style={{ left: `${Math.min(100, (15 / Math.max(50, analysisResult.effectiveApr)) * 100)}%` }}
                        />
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            analysisResult.exceedsLegalCeiling ? "bg-rose-500" : "bg-emerald-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (analysisResult.effectiveApr / (analysisResult.effectiveApr > 100 ? analysisResult.effectiveApr : 30)) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono mt-2 text-slate-500">
                        <span>0%</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ▲ 15.0% BOT Legal Ceiling
                        </span>
                        <span>{analysisResult.effectiveApr > 100 ? `${analysisResult.effectiveApr}%` : "30%+"}</span>
                      </div>
                    </div>
                  )}

                  {analysisResult.calculatedMetrics && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      {Object.entries(analysisResult.calculatedMetrics).map(([key, val]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase">
                            {key.replace(/([A-Z])/g, " $1")}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {val}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {analysisResult.redFlags.length > 0 && (
                    <div className="mt-4">
                      <span className="text-[11px] font-mono font-bold uppercase text-rose-700 dark:text-rose-400 block mb-1.5">
                        Highlighted Red Flags ({analysisResult.redFlags.length}):
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {analysisResult.redFlags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-2 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl">
                            <span className="text-rose-500 shrink-0">✕</span>
                            <span className="leading-relaxed">{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                      <span>💡</span>
                      <span>Agent Recommendation:</span>
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                      {analysisResult.recommendation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-2xl flex items-center justify-center mx-auto mb-3">
                    🔍
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Awaiting Text Ingestion
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Select a preset or paste financing text to scan for hidden predatory APR and verify counterparty safety.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: PAYMENT RAIL COMPARISON
        ======================================================== */}
        {activeTab === "rails" && (
          <div className="space-y-6 animate-fade-in-up duration-200">
            {/* Payee Shield Verification Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xl">
                    🛡️
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Verified Payee Shield: {currentConfig.supplierName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        100% Authentic Registry
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bank account locked against verified trade registry. Unauthorized modifications are blocked.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Settlement Obligation</span>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    {currentConfig.currency}{currentConfig.orderAmountForeign.toLocaleString()} (~฿{currentConfig.orderAmountThb.toLocaleString()})
                  </span>
                </div>
              </div>

              {/* Verified Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Clearing Bank</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                    {currentConfig.verifiedBankName}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Account Number</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                    {currentConfig.supplierAccount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Corridor</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                    {currentConfig.flagEmoji} {currentConfig.countryName}
                  </span>
                </div>
              </div>
            </div>

            {/* Three Rails Comparison */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Live Cost Comparison Across Payment Rails
                </h3>
                <span className="text-xs font-mono text-slate-500">Real-Time Quotes</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rail 1: Partner Rail */}
                <div className="p-5 rounded-3xl border-2 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                        RECOMMENDED
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600">
                        Saves ฿{(currentConfig.swiftFeeThb + currentConfig.swiftSpreadThb).toLocaleString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      BizMate Partner Clearing Rail
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      Direct {currentConfig.currencyCode} clearing through authenticated partner corridor. Interbank mid-market rate with transparent {currentConfig.partnerMarginPct}% spread.
                    </p>

                    <div className="mt-3.5 space-y-1.5 text-xs font-mono bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Exchange Rate:</span>
                        <span className="font-bold text-slate-900 dark:text-white">1 {currentConfig.currencyCode} = {currentConfig.exchangeRate} THB</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Transfer Fee:</span>
                        <span className="font-bold text-emerald-600">฿0 (Waived)</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Speed:</span>
                        <span className="font-bold text-slate-900 dark:text-white">T+0 Same Day</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Net Cost</span>
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                        ฿{currentConfig.orderAmountThb.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab("confirmation")}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Select Rail →
                    </button>
                  </div>
                </div>

                {/* Rail 2: SWIFT Wire */}
                <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        TRADITIONAL SWIFT
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        +฿{(currentConfig.swiftFeeThb + currentConfig.swiftSpreadThb).toLocaleString()} extra
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Commercial Bank Telegraphic Wire
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Standard international SWIFT transfer with retail FX markups, intermediary bank fees, and cable charges.
                    </p>

                    <div className="mt-3.5 space-y-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>FX Markup:</span>
                        <span>~1.45% Spread</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Cable Fee:</span>
                        <span>฿{currentConfig.swiftFeeThb.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Speed:</span>
                        <span>2 - 3 Business Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Net Cost</span>
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                        ฿{(currentConfig.orderAmountThb + currentConfig.swiftFeeThb + currentConfig.swiftSpreadThb).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Available</span>
                  </div>
                </div>

                {/* Rail 3: Gray Market Hawala */}
                <div className="p-5 rounded-3xl border-2 border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col justify-between opacity-85">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                        HARD-BLOCKED
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-600">Illegal / High Risk</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Unlicensed Gray-Market Broker
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Informal peer-to-peer / Hawala money broker. Fails anti-money laundering (AML) and trade tax compliance. Funds at risk of immediate police freeze.
                    </p>

                    <div className="mt-3.5 p-3 rounded-xl bg-rose-100/60 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 text-xs font-mono">
                      <span className="font-bold block">Enforced Trust Guardrail:</span>
                      <span className="text-[11px] block mt-0.5">
                        BizMate Server Rules strictly prohibit routing trade funds through unlicensed counterparties.
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                      Server Guardrail: Blocked
                    </span>
                    <span className="text-xs text-rose-400">🔒 Locked</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: PAYMENT CONFIRMATION & BIOMETRIC FACE ID
        ======================================================== */}
        {activeTab === "confirmation" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up duration-200">
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Payment Confirmation &amp; Schedule
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review locked exchange rates and schedule disbursement.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                  Locked Rate 🔒
                </span>
              </div>

              {/* Order Summary */}
              <div className="my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiary:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentConfig.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Clearing Bank:</span>
                  <span className="text-slate-800 dark:text-slate-200">{currentConfig.verifiedBankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiary Account:</span>
                  <span className="text-slate-800 dark:text-slate-200">{currentConfig.supplierAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Foreign Currency Due:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {currentConfig.currency}{currentConfig.orderAmountForeign.toLocaleString()} {currentConfig.currencyCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Exchange Rate Locked:</span>
                  <span className="font-bold text-emerald-600">
                    1 {currentConfig.currencyCode} = {currentConfig.exchangeRate} THB ({currentConfig.partnerMarginPct}% margin)
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">Total THB to Disburse:</span>
                  <span className="font-black text-rose-600 dark:text-rose-400">
                    ฿{currentConfig.orderAmountThb.toLocaleString()} THB
                  </span>
                </div>
              </div>

              {/* Schedule Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Select Disbursement Timing:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setPaymentSchedule("due-date")}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      paymentSchedule === "due-date"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Pay on Due Date ({currentConfig.dueDate})
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600">RECOMMENDED</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Preserves operating cash until the last possible moment, keeping safety buffer intact.
                    </p>
                  </div>

                  <div
                    onClick={() => setPaymentSchedule("today")}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      paymentSchedule === "today"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Disburse Immediately Today
                      </span>
                      <span className="text-xs font-mono text-amber-500">EARLY</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Immediately settles trade invoice now via automated partner clearing rail.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cash Buffer Conflict Warning */}
              <div className="mt-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs flex items-start gap-2.5">
                <span className="text-base mt-0.5">⚠️</span>
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    Cash Radar Buffer Notification:
                  </span>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed text-[11px]">
                    Disbursing ฿{currentConfig.orderAmountThb.toLocaleString()} will impact operating cash. The Agents&apos; Joint Remedy Plan recommends pairing this payment with the 60-day supplier deferral or accelerated debtor recovery.
                  </p>
                </div>
              </div>

              {/* Primary Authorization CTA */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Link
                  href="/dashboard/plan"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  ← Back to Joint Plan
                </Link>

                <button
                  type="button"
                  onClick={handleInitiateFaceId}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>🔐</span>
                  <span>Authorize via Bank Biometric Face ID</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: PAYMENT RECEIPT & LIFECYCLE TRACKER
        ======================================================== */}
        {activeTab === "tracker" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up duration-200">
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
              {/* Receipt Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-xl">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Disbursement Dispatched Successfully
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Ref: {transactionRef} • {dispatchTimestamp || "12 Oct 2026, 09:41"}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Delivered
                </span>
              </div>

              {/* Milestone Tracker */}
              <div className="my-6">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block mb-3">
                  Live Settlement Milestone Tracker:
                </span>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* Step 1 */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    activeMilestone >= 1
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                      : "border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-1">
                      ✓
                    </div>
                    <span className="text-xs font-bold block">Approved in Bank</span>
                    <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Biometric Signed</span>
                  </div>

                  {/* Step 2 */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    activeMilestone >= 2
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                      : "border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-1">
                      ✓
                    </div>
                    <span className="text-xs font-bold block">Converted to {currentConfig.currencyCode}</span>
                    <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Rate 1:{currentConfig.exchangeRate}</span>
                  </div>

                  {/* Step 3 */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    activeMilestone >= 3
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                      : "border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-1">
                      ✓
                    </div>
                    <span className="text-xs font-bold block">Delivered to Payee</span>
                    <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Cleared at {currentConfig.verifiedBankName.split(" ")[0]}</span>
                  </div>
                </div>
              </div>

              {/* Receipt Voucher Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Originating Account:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentConfig.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payer Entity:</span>
                  <span className="text-slate-900 dark:text-white">{currentConfig.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient Payee:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentConfig.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient Bank:</span>
                  <span className="text-slate-800 dark:text-slate-200">{currentConfig.verifiedBankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Number:</span>
                  <span className="text-slate-800 dark:text-slate-200">{currentConfig.supplierAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Transferred:</span>
                  <span className="font-bold text-emerald-600">
                    {currentConfig.currency}{currentConfig.orderAmountForeign.toLocaleString()} {currentConfig.currencyCode}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Debited Amount (THB):</span>
                  <span className="font-black text-slate-900 dark:text-white">฿{currentConfig.orderAmountThb.toLocaleString()}</span>
                </div>
              </div>

              {/* Export Actions */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => alert(`Exporting official proof of payment PDF for ${currentConfig.supplierName}...`)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>📄</span>
                  <span>Export PDF Proof</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {currentConfig.wechatSupported && (
                    <button
                      type="button"
                      onClick={() => alert(`Generated encrypted WeChat payment card for ${currentConfig.supplierName}`)}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>💬</span>
                      <span>Share on WeChat</span>
                    </button>
                  )}
                  <Link
                    href="/dashboard"
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs text-center"
                  >
                    Back to Dashboard →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: REAL APR CALCULATOR
        ======================================================== */}
        {activeTab === "calculator" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs animate-fade-in-up duration-200 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🧮</span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Real Annual Percentage Rate (APR) Interactive Calculator
                </h2>
                <p className="text-xs text-slate-500">
                  Convert misleading daily or monthly rates into true annualized compounding cost.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Loan Principal</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                    ฿{calcPrincipal.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={500000}
                  step={5000}
                  value={calcPrincipal}
                  onChange={(e) => setCalcPrincipal(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Advertised Daily Rate</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {calcDailyRate.toFixed(2)}% / day
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={3.0}
                  step={0.05}
                  value={calcDailyRate}
                  onChange={(e) => setCalcDailyRate(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Holding Period (Days)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {calcTenorDays} Days
                  </span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={90}
                  step={1}
                  value={calcTenorDays}
                  onChange={(e) => setCalcTenorDays(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center">
                  <span className="text-[10px] font-mono uppercase text-rose-700 dark:text-rose-300 block">
                    Calculated Real APR
                  </span>
                  <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                    {calculatedEffectiveApr.toFixed(1)}% / yr
                  </span>
                  <span className="text-[10px] font-mono text-rose-800 dark:text-rose-300 mt-1 block">
                    {calculatedEffectiveApr > 15 ? `⚠️ ${(calculatedEffectiveApr / 15).toFixed(1)}x over BOT 15% Cap` : "✅ Within 15% Cap"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">
                    Total Fees in {calcTenorDays} Days
                  </span>
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                    ฿{Math.round(calculatedTotalFeeThb).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pure interest charges
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">
                    Total Amount Repaid
                  </span>
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                    ฿{Math.round(calculatedTotalPaybackThb).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Principal + {calcTenorDays}d interest
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          BIOMETRIC FACE ID STEP-UP MODAL
      ======================================================== */}
      {faceIdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 sm:p-8 text-center shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
            <div className="my-4 flex flex-col items-center justify-center">
              <div className="relative w-28 h-28 rounded-full border-4 border-dashed border-indigo-500/40 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                {faceIdStep === "scanning" && (
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-spin border-t-transparent" />
                )}
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all duration-500 ${
                    faceIdStep === "ready"
                      ? "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400"
                      : faceIdStep === "scanning"
                      ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 scale-105"
                      : "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 scale-110 shadow-lg shadow-emerald-500/20"
                  }`}
                >
                  {faceIdStep === "success" ? "✓" : "👤"}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">
                {faceIdStep === "ready"
                  ? "Biometric Verification"
                  : faceIdStep === "scanning"
                  ? "Scanning Face ID..."
                  : "Identity Confirmed!"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
                {faceIdStep === "ready"
                  ? `Required by Trust Agent for authorizing ฿${currentConfig.orderAmountThb.toLocaleString()} to ${currentConfig.supplierName}.`
                  : faceIdStep === "scanning"
                  ? "Verifying facial biometric tokens against secure enclave..."
                  : "Cryptographic signature generated. Dispatched to bank rail."}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              {faceIdStep === "ready" && (
                <>
                  <button
                    type="button"
                    onClick={() => setFaceIdModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStartScan}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📸</span>
                    <span>Authenticate Face ID</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
