"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";

interface FundingOption {
  id: string;
  rank: number;
  title: string;
  category: "SUPPLIER_TERMS" | "BANK_LOAN" | "CREDIT_LINE" | "FACTORING" | "MICRO_LOAN";
  provider: string;
  providerLogo?: string;
  costDescription: string;
  effectiveApr: string;
  nominalApr: string;
  repaymentTerm: string;
  maxAmountThb: number;
  availableAmountThb: number;
  processingTime: string;
  qualificationStatus: "QUALIFIED" | "RECOMMENDED" | "LOCKED";
  requiredHealthScore: number;
  breakdown: {
    monthlyPaymentThb: number;
    totalInterestThb: number;
    processingFeeThb: number;
    netDisbursedThb: number;
  };
  pros: string[];
  cons: string[];
  trustSummaryScope: string;
  isSupplierTerm?: boolean;
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
    pendingOrderCny: number;
    pendingOrderCurrency: string;
    pendingOrderAmount: number;
    pendingOrderThb: number;
    pendingDueDate: string;
  };
  activeBanksCount?: number;
}

export default function FundingAgentHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("kbank");
  const [isBankConnected, setIsBankConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summaryData, setSummaryData] = useState<FinancialSummaryData | null>(null);

  // Offer breakdown modal (FU-02)
  const [selectedOffer, setSelectedOffer] = useState<FundingOption | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState<boolean>(false);

  // Application Review modal (FU-03)
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState<boolean>(false);
  const [consentScope, setConsentScope] = useState<"SUMMARY_ONLY" | "FULL_STATEMENTS">("SUMMARY_ONLY");
  const [isSubmittingApp, setIsSubmittingApp] = useState<boolean>(false);

  // Cross-Border Supplier Terms Workflow (FU-05)
  const [isSupplierTermsModalOpen, setIsSupplierTermsModalOpen] = useState<boolean>(false);
  const [termsLanguageView, setTermsLanguageView] = useState<"DUAL" | "CN" | "EN">("DUAL");
  const [isSendingTermsProposal, setIsSendingTermsProposal] = useState<boolean>(false);

  // Application Status Lifecycle (FU-04)
  const [activeApplication, setActiveApplication] = useState<{
    id: string;
    provider: string;
    requestedAmount: number;
    stage: "SENT" | "REVIEWING" | "DECISION" | "DISBURSED";
    submittedAt: string;
    statusText: string;
  } | null>(null);

  // Biometric step-up feedback
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Fetch summary on load and listen to bank change
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
      console.error("Failed to fetch funding telemetry:", err);
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

  // Derive dynamic supplier order and liquidity deficit passed from Cash Agent
  const supplier = summaryData?.supplierHistory;
  const currentHealth = summaryData?.healthScore?.overallScore || 78;
  const pendingForeignAmount = supplier?.pendingOrderAmount || 100000;
  const pendingCurrency = supplier?.pendingOrderCurrency || "¥";
  const pendingThbEstimate = supplier?.pendingOrderThb || 482500;
  const safetyBufferThb = summaryData?.safetyBuffer || 80000;
  const supplierName = supplier?.name || "Shenzhen Chen Tech Electronics Co., Ltd.";
  const isPersonal = summaryData?.bankId === "personal";

  // Dynamic ranking of 5 qualified and locked funding options
  const fundingOptions: FundingOption[] = [
    {
      id: "fu-opt-1",
      rank: 1,
      title: `60-Day Cross-Border Supplier Terms (${supplierName.split(" ")[0]})`,
      category: "SUPPLIER_TERMS",
      provider: supplierName,
      costDescription: "1.1% one-time deferral fee (~฿5,307)",
      effectiveApr: "6.6% APR equivalent",
      nominalApr: "1.1% flat fee",
      repaymentTerm: "60 Days (due 25 Dec 2026)",
      maxAmountThb: pendingThbEstimate,
      availableAmountThb: pendingThbEstimate,
      processingTime: "Instant via WeChat Confirmation",
      qualificationStatus: "RECOMMENDED",
      requiredHealthScore: 70,
      breakdown: {
        monthlyPaymentThb: 0,
        totalInterestThb: 5307,
        processingFeeThb: 0,
        netDisbursedThb: pendingThbEstimate,
      },
      pros: [
        "Preserves 100% of ฿80,000 cash safety buffer on 26 Oct",
        "Zero bank debt footprint; financed via Chinese export credit guarantee",
        "Backed by 12 months verified continuous payment history",
      ],
      cons: [
        "Requires Mr. Chen's counter-confirmation via WeChat/Email",
      ],
      trustSummaryScope: "Redacted trade verification record only (no raw bank statements shared)",
      isSupplierTerm: true,
    },
    {
      id: "fu-opt-2",
      rank: 2,
      title: "Krungthai 'Sip Muen' SME Working Capital",
      category: "BANK_LOAN",
      provider: "Krungthai Bank (KTB)",
      providerLogo: "/logos/KTB.png",
      costDescription: "9.5% APR interest (~฿4,750 / yr)",
      effectiveApr: "9.5% APR per annum",
      nominalApr: "9.5% APR",
      repaymentTerm: "12 Months Equal Installments",
      maxAmountThb: 1000000,
      availableAmountThb: 300000,
      processingTime: "1 Business Day (Digital Disbursement)",
      qualificationStatus: currentHealth >= 75 ? "QUALIFIED" : "LOCKED",
      requiredHealthScore: 75,
      breakdown: {
        monthlyPaymentThb: 26312,
        totalInterestThb: 15744,
        processingFeeThb: 1500,
        netDisbursedThb: 298500,
      },
      pros: [
        "Pre-approved clean loan backed by Thai SME credit guarantee (TCG)",
        "No land or fixed asset collateral required",
        "Direct deposit into operating account",
      ],
      cons: [
        "Increases monthly debt service obligation by ฿26,312/mo",
      ],
      trustSummaryScope: "Digital Business Passport + 12-month summary cash flow metrics",
    },
    {
      id: "fu-opt-3",
      rank: 3,
      title: "BankX Revolving SME Line of Credit",
      category: "CREDIT_LINE",
      provider: "Partner Commercial Bank (KBANK / SCB)",
      providerLogo: "/logos/KBANK.png",
      costDescription: "10.8% APR (Only pay for drawn balance)",
      effectiveApr: "10.8% APR variable",
      nominalApr: "10.8% APR",
      repaymentTerm: "Rolling 30-Day Drawdown",
      maxAmountThb: 500000,
      availableAmountThb: 200000,
      processingTime: "Instant Drawdown (Mobile App)",
      qualificationStatus: currentHealth >= 70 ? "QUALIFIED" : "LOCKED",
      requiredHealthScore: 70,
      breakdown: {
        monthlyPaymentThb: 1800,
        totalInterestThb: 3600,
        processingFeeThb: 500,
        netDisbursedThb: 200000,
      },
      pros: [
        "Extreme flexibility: draw exactly what is needed for payroll or inventory",
        "No interest charged on undrawn limit",
      ],
      cons: [
        "Higher variable rate than supplier terms or government-backed SME loans",
      ],
      trustSummaryScope: "Certified transaction hygiene report (0 bounced checks verification)",
    },
    {
      id: "fu-opt-4",
      rank: 4,
      title: "Invoice Factoring (B2B Receivables Advance)",
      category: "FACTORING",
      provider: "Siam Commercial Factoring",
      providerLogo: "/logos/SCB.png",
      costDescription: "2.5% fee on advanced invoice amount",
      effectiveApr: "15.0% APR equivalent",
      nominalApr: "2.5% flat fee",
      repaymentTerm: "30-45 Days (Auto-settles upon debtor payment)",
      maxAmountThb: 150000,
      availableAmountThb: 35000,
      processingTime: "4 Hours (Post Invoice Verification)",
      qualificationStatus: "QUALIFIED",
      requiredHealthScore: 65,
      breakdown: {
        monthlyPaymentThb: 0,
        totalInterestThb: 875,
        processingFeeThb: 250,
        netDisbursedThb: 33875,
      },
      pros: [
        "Liquidates outstanding customer invoices into immediate cash today",
        "Does not count as long-term financial debt",
      ],
      cons: [
        "Covers only outstanding debtor invoices (e.g. Boutique Siam ฿35,000)",
        "Cannot cover the full supplier order alone",
      ],
      trustSummaryScope: "Invoice audit trail and customer payment habit profile",
    },
    {
      id: "fu-opt-5",
      rank: 5,
      title: "GSB QR Digital Micro Loan (Omnichannel Stalls)",
      category: "MICRO_LOAN",
      provider: "Government Savings Bank (GSB)",
      providerLogo: "/logos/GSB.png",
      costDescription: "12.5% APR fixed micro working capital",
      effectiveApr: "12.5% APR fixed",
      nominalApr: "12.5% APR",
      repaymentTerm: "6 Months",
      maxAmountThb: 100000,
      availableAmountThb: 50000,
      processingTime: "2 Business Days",
      qualificationStatus: currentHealth >= 60 ? "QUALIFIED" : "LOCKED",
      requiredHealthScore: 60,
      breakdown: {
        monthlyPaymentThb: 8640,
        totalInterestThb: 1840,
        processingFeeThb: 0,
        netDisbursedThb: 50000,
      },
      pros: [
        "Qualified directly via Shopee, TikTok Shop & PromptPay QR revenue streams",
      ],
      cons: [
        "Small maximum ticket size (cap ฿100,000)",
      ],
      trustSummaryScope: "Platform sales volume verification report",
    },
  ];

  // Open Offer Breakdown Sheet (FU-02)
  const handleOpenBreakdown = (opt: FundingOption) => {
    setSelectedOffer(opt);
    setIsOfferModalOpen(true);
  };

  // Open Application Review Sheet (FU-03)
  const handleProceedToApplication = (opt: FundingOption) => {
    setSelectedOffer(opt);
    setIsOfferModalOpen(false);
    setIsApplicationModalOpen(true);
  };

  // Submit Loan Application (Protected by Biometric Step-Up Simulation)
  const handleSubmitApplication = () => {
    if (!selectedOffer) return;
    setIsSubmittingApp(true);

    setTimeout(() => {
      setIsSubmittingApp(false);
      setIsApplicationModalOpen(false);

      // Create Active Application Lifecycle (FU-04)
      setActiveApplication({
        id: `APP-BIZMATE-${Date.now().toString().slice(-6)}`,
        provider: selectedOffer.provider,
        requestedAmount: selectedOffer.availableAmountThb,
        stage: "SENT",
        submittedAt: "Today, 09:42 AM ICT",
        statusText: "Application securely dispatched with Biometric Authorization Seal. Awaiting lender verification.",
      });

      setActionToast(`Application for ${selectedOffer.title} submitted with Biometric Seal! Lender reviewing dossier.`);
      setTimeout(() => setActionToast(null), 5000);
    }, 1200);
  };

  // Open Supplier Terms Workflow (FU-05)
  const handleOpenSupplierTerms = () => {
    setIsSupplierTermsModalOpen(true);
  };

  // Dispatch Supplier Terms Proposal via Central Approval / WeChat
  const handleDispatchSupplierTerms = () => {
    setIsSendingTermsProposal(true);
    setTimeout(() => {
      setIsSendingTermsProposal(false);
      setIsSupplierTermsModalOpen(false);
      setActionToast(`60-Day Terms proposal sent to ${supplierName.split(" ")[0]} via WeChat & Email! Action logged in Central Inbox.`);
      setTimeout(() => setActionToast(null), 5000);
    }, 1000);
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
            <span className="text-amber-600 dark:text-amber-400 font-bold">
              Funding Agent &amp; Capital Marketplace
            </span>
          </div>

          {/* Connected Bank Switcher */}
          {isBankConnected && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
                Trade Registry:
              </span>
              <select
                value={selectedBankId}
                onChange={(e) => handleSwitchBank(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-xs"
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
            <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              🔒
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-block mb-3">
              Bank Connection Required
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Funding Agent &amp; Marketplace Locked
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-md mx-auto">
              To match the cheapest working capital options, prepare pre-filled lender applications, and negotiate cross-border supplier payment extensions, please connect or select an operating bank account first.
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
            {/* Notification Toast */}
            {actionToast && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>💰</span>
                  <span>{actionToast}</span>
                </div>
                <button
                  onClick={() => setActionToast(null)}
                  className="text-amber-600 dark:text-amber-400 p-1 cursor-pointer"
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
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold animate-bounce shadow-xs">
                      💰
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                          Funding Agent
                        </h1>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          1.1% Rate Matched
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cheapest Capital Matching &amp; Cross-Border Supplier Terms
                      </p>
                    </div>
                  </div>

                  {/* Speech Bubble Context - Friendly & Crisp */}
                  <div className="mt-3 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
                    <span className="text-base shrink-0">💬</span>
                    <div>
                      {isPersonal ? (
                        <span>Automated yield sweep &amp; freelance liquidity buffer optimization active.</span>
                      ) : (
                        <span>
                          Cash deficit flagged for 26 Oct: <strong>{pendingCurrency}{pendingForeignAmount.toLocaleString()} (~฿{pendingThbEstimate.toLocaleString()})</strong> due. Ranked 5 cheapest financing routes to preserve your ฿{safetyBufferThb.toLocaleString()} safety buffer.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational Boundaries */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span><strong>Auto:</strong> Evaluates qualifying credit lines against Health Score ({currentHealth}/100)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span><strong>Consent Trigger:</strong> Asks before submitting loan applications or terms</span>
                    </div>
                  </div>
                </div>

                {/* Quick Gap Transfer Card (FU-01) */}
                <div className="flex flex-col gap-2 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 min-w-[230px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] text-slate-400 font-medium">Liquidity Gap Target</span>
                    <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                      ฿{pendingThbEstimate > 0 ? (pendingThbEstimate).toLocaleString() : "96,000"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Target Due Date: 26 Oct 2026
                  </div>
                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700" />
                  <button
                    type="button"
                    onClick={handleOpenSupplierTerms}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>⚡</span>
                    <span>Negotiate 60-Day Terms</span>
                  </button>
                </div>
              </div>

              {/* Data Lineage Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  Synchronized with Cash Radar &amp; True Cost Risk Engine
                </span>
                <Link href="/dashboard/true-cost" className="text-amber-600 dark:text-amber-400 hover:underline">
                  Validate External Ad / Loan Flyer →
                </Link>
              </div>
            </div>

            {/* Active Application Status Lifecycle (FU-04) if exists */}
            {activeApplication && (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-8 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Application Status Lifecycle ({activeApplication.id})
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {activeApplication.stage}
                  </span>
                </div>

                {/* Step Tracker */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold font-mono my-4">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    1. Sent ✓
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 animate-pulse">
                    2. Lender Reviews
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                    3. Decision
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                    4. Disbursement
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>{activeApplication.statusText}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ฿{activeApplication.requestedAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Qualified & Ranked Funding Marketplace (Cheapest First) */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Qualified Capital Options (Ranked by Total Cost)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Transparent pricing audited by True Cost Agent. Zero hidden broker markups.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Health Verified: {currentHealth}/100
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {fundingOptions.map((opt) => {
                  const isTopPick = opt.rank === 1;
                  const isLocked = opt.qualificationStatus === "LOCKED";
                  return (
                    <div
                      key={opt.id}
                      className={`p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border transition-all ${
                        isTopPick
                          ? "border-amber-300 dark:border-amber-700/80 shadow-md ring-1 ring-amber-400/20"
                          : "border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300"
                      } ${isLocked ? "opacity-70 bg-slate-50/50 dark:bg-slate-950/40" : ""}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Rank {opt.rank}
                            </span>
                            {isTopPick && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                🌟 Lowest Total Cost of Capital
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                                isLocked
                                  ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                                  : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {isLocked ? `Locked (Min Score ${opt.requiredHealthScore})` : "Qualified"}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {opt.processingTime}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {opt.title}
                          </h3>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                            <div>
                              <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Cost</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                                {opt.costDescription}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-mono text-slate-400 uppercase block">Effective APR</span>
                              <span className="font-bold text-slate-900 dark:text-white font-mono">
                                {opt.effectiveApr}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-mono text-slate-400 uppercase block">Available Limit</span>
                              <span className="font-bold text-slate-900 dark:text-white font-mono">
                                ฿{opt.availableAmountThb.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-mono text-slate-400 uppercase block">Term</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {opt.repaymentTerm}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                          {opt.isSupplierTerm ? (
                            <button
                              type="button"
                              onClick={handleOpenSupplierTerms}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>Negotiate Draft (FU-05)</span>
                              <span>→</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleProceedToApplication(opt)}
                              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                isLocked
                                  ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}
                            >
                              <span>{isLocked ? "Score Too Low" : "Apply with Face ID"}</span>
                              <span>→</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenBreakdown(opt)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                          >
                            Pricing Breakdown →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Offer Breakdown Sheet (FU-02) */}
      {isOfferModalOpen && selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pricing &amp; Cost Breakdown (True Cost Audited)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedOffer.title}
                </h4>
                <p className="text-slate-500 mt-0.5">Offered by {selectedOffer.provider}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nominal Interest Rate:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedOffer.nominalApr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Effective Annualized APR:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{selectedOffer.effectiveApr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Capital Disbursed:</span>
                  <span className="font-bold text-slate-900 dark:text-white">฿{selectedOffer.breakdown.netDisbursedThb.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Interest / Financed Cost:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">฿{selectedOffer.breakdown.totalInterestThb.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Origination / Processing Fee:</span>
                  <span className="font-bold text-slate-900 dark:text-white">฿{selectedOffer.breakdown.processingFeeThb.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-slate-700 dark:text-slate-300">
                <span className="font-bold text-blue-800 dark:text-blue-300 block mb-1">
                  Trust Scope Disclosure
                </span>
                <p className="text-[11px] leading-relaxed">
                  {selectedOffer.trustSummaryScope}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleProceedToApplication(selectedOffer)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Proceed to Application →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Review Sheet (FU-03) */}
      {isApplicationModalOpen && selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✍️</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pre-filled Application Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApplicationModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Applicant Business:</span>
                  <span className="font-bold font-sans text-slate-900 dark:text-white">{summaryData?.company || "Ploy Select Co., Ltd."}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lender / Rail:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedOffer.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Amount:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">฿{selectedOffer.availableAmountThb.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Repayment Period:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedOffer.repaymentTerm}</span>
                </div>
              </div>

              {/* Consent Scope Picker (PDPA Compliant) */}
              <div className="space-y-2">
                <span className="text-slate-600 dark:text-slate-400 font-bold font-sans block">
                  Select Data Access Scope for Lender:
                </span>
                <div
                  onClick={() => setConsentScope("SUMMARY_ONLY")}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    consentScope === "SUMMARY_ONLY"
                      ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold font-sans text-slate-900 dark:text-white">
                      Summary Dossier Only (Recommended)
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-600">Standard</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-500">
                    Shares only certified health score, zero-overdraft proof, and aggregate cash buffer. Raw transactions remain private.
                  </p>
                </div>

                <div
                  onClick={() => setConsentScope("FULL_STATEMENTS")}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    consentScope === "FULL_STATEMENTS"
                      ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold font-sans text-slate-900 dark:text-white">
                      Full 12-Month Statements
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-600">Extended</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-500">
                    Includes itemized line-by-line banking history. Required only for commercial loans exceeding ฿2,000,000.
                  </p>
                </div>
              </div>

              {/* Biometric Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 font-sans text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>🔐</span>
                <span>Protected by Biometric Step-Up: Submitting initiates owner Face ID confirmation.</span>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsApplicationModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingApp}
                onClick={handleSubmitApplication}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmittingApp ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Face ID...</span>
                  </>
                ) : (
                  <>
                    <span>Submit with Face ID</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Border Supplier Terms Workflow (FU-05) */}
      {isSupplierTermsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤝</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cross-Border Supplier Terms Workflow (FU-05)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierTermsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Proposal Comparison Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                    Option A (Current Due Date)
                  </span>
                  <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                    {pendingCurrency}{pendingForeignAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Due: 26 Oct 2026</div>
                  <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    Breaches ฿{safetyBufferThb.toLocaleString()} safety buffer
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70">
                  <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 uppercase block mb-1">
                    Option B (60-Day Terms Match)
                  </span>
                  <div className="text-base font-black font-mono text-amber-700 dark:text-amber-300">
                    {pendingCurrency}{(pendingForeignAmount * 1.011).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Due: 25 Dec 2026 (+60 Days)</div>
                  <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Preserves 100% of buffer (~฿5,307 fee)
                  </div>
                </div>
              </div>

              {/* Language Switcher for AI Negotiation Draft */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Dual-Language AI Negotiation Draft
                </span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTermsLanguageView("DUAL")}
                    className={`px-2 py-1 rounded-lg ${
                      termsLanguageView === "DUAL" ? "bg-amber-500 text-white font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    Dual (CN + TH)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTermsLanguageView("CN")}
                    className={`px-2 py-1 rounded-lg ${
                      termsLanguageView === "CN" ? "bg-amber-500 text-white font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    中文
                  </button>
                  <button
                    type="button"
                    onClick={() => setTermsLanguageView("EN")}
                    className={`px-2 py-1 rounded-lg ${
                      termsLanguageView === "EN" ? "bg-amber-500 text-white font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Draft Message Container */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                {(termsLanguageView === "DUAL" || termsLanguageView === "CN") && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Recipient: Mr. Chen (WeChat / 深圳陈总)
                    </span>
                    <p className="font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      尊敬的陈总您好，感谢过去12个月贵司在电子配件供应链上的大力支持。关于原定于10月26日到期的订单结算（¥{pendingForeignAmount.toLocaleString()}），我们希望申请采用60天贸易账期（延期至12月25日结算），并愿意承担1.1%标准出口信用利息（结算金额¥{(pendingForeignAmount * 1.011).toLocaleString()}）。我们已通过银行认证通道开具商业信用凭证，期待您的确认。
                    </p>
                  </div>
                )}

                {(termsLanguageView === "DUAL" || termsLanguageView === "EN") && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Owner Validation Translation (Thai / English)
                    </span>
                    <p className="font-sans text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      เรียนคุณเฉิน (Shenzhen Chen Tech) ขอขอบคุณสำหรับความร่วมมือทางการค้าตลอด 12 เดือนที่ผ่านมา สำหรับยอดสั่งซื้อ ¥{pendingForeignAmount.toLocaleString()} ที่จะครบกำหนดในวันที่ 26 ต.ค. ทางเราขอขยายเทอมเป็น 60 วัน (ชำระ 25 ธ.ค. 2026) โดยยินดีรับอัตราค่าธรรมเนียม 1.1% ตามมาตรฐานสินเชื่อส่งออกจีน (ยอดรวม ¥{(pendingForeignAmount * 1.011).toLocaleString()}) เอกสารยืนยันความน่าเชื่อถือถูกออกผ่านระบบธนาคารเรียบร้อยแล้ว
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsSupplierTermsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSendingTermsProposal}
                onClick={handleDispatchSupplierTerms}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isSendingTermsProposal ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Dispatching Proposal...</span>
                  </>
                ) : (
                  <>
                    <span>Dispatch Proposal via WeChat &amp; Email</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
