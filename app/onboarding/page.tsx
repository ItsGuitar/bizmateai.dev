"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { getSession, AuthUser } from "@/lib/auth-client";

// Step 1: Partner & Open Banking Institutions
interface BankOption {
  id: string;
  name: string;
  code: string;
  bg: string;
  text: string;
  desc: string;
  logoUrl: string;
  badge?: string;
  isPartner?: boolean;
}

const BANKS: BankOption[] = [
  {
    id: "kbank",
    name: "Kasikornbank (Partner Bank)",
    code: "KBANK",
    bg: "bg-[#138f2d]",
    text: "text-white",
    desc: "Ploy Select Co., Ltd. • 12-Month SME Account",
    logoUrl: "/logos/KBANK.png",
    badge: "Recommended Partner",
    isPartner: true,
  },
  {
    id: "scb",
    name: "Siam Commercial Bank",
    code: "SCB",
    bg: "bg-[#4e2a84]",
    text: "text-white",
    desc: "Apex Craft Furniture • 12-Month B2B Export Gateway",
    logoUrl: "/logos/SCB.png",
  },
  {
    id: "bbl",
    name: "Bangkok Bank",
    code: "BBL",
    bg: "bg-[#1e3a8a]",
    text: "text-white",
    desc: "BioHarvest Agro Tech • 12-Month Agri-Tech Gateway",
    logoUrl: "/logos/BBL.png",
  },
  {
    id: "personal",
    name: "Personal / Freelancer Account",
    code: "INDIVIDUAL",
    bg: "bg-emerald-600",
    text: "text-white",
    desc: "Kittisak Somchai • 3-Month Individual Cash Flow",
    logoUrl: "/logos/PromptPay.png",
    badge: "Individual / 3M",
  },
];

// Step 2: Sales Channels Matrix
interface ChannelOption {
  id: string;
  name: string;
  emoji: string;
  logoUrl: string;
  purpose: string;
  description: string;
  enabled: boolean;
}

const INITIAL_CHANNELS: ChannelOption[] = [
  {
    id: "shopee",
    name: "Shopee Seller Center",
    emoji: "🛒",
    logoUrl: "/logos/shopee.svg",
    purpose: "Cash Inflow Mapping",
    description: "Payout schedules map directly into 13-week Cash Radar inflows.",
    enabled: true,
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    emoji: "🎵",
    logoUrl: "/logos/tiktok.svg",
    purpose: "Cash Inflow Mapping",
    description: "Settlement cycles and GMV trends feed into real-time liquidity projections.",
    enabled: true,
  },
  {
    id: "lazada",
    name: "Lazada Partner Portal",
    emoji: "🛍️",
    logoUrl: "/logos/lazada.png",
    purpose: "Health Score Telemetry",
    description: "Fulfillment reliability and returns ratio feed Health Score calculation.",
    enabled: true,
  },
  {
    id: "promptpay",
    name: "Stall PromptPay QR",
    emoji: "📱",
    logoUrl: "/logos/PromptPay.png",
    purpose: "Daily Cash Velocity",
    description: "Daily retail cash collection mapped to working capital buffer.",
    enabled: true,
  },
  {
    id: "line_oa",
    name: "LINE Official Account (LINE OA)",
    emoji: "💬",
    logoUrl: "/logos/line.svg",
    purpose: "Owner-Approved Reminders",
    description: "Enables Collections Agent to dispatch polite AR reminder drafts after your sign-off.",
    enabled: true,
  },
];

// Step 3: The 6 Provisioning Agents
interface ProvisioningAgent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  taskLabel: string;
  resultSummary: string;
  status: "pending" | "working" | "done";
}

const PROVISIONING_AGENTS: ProvisioningAgent[] = [
  {
    id: "cash",
    name: "Cash Agent",
    role: "13-Week Cash Radar",
    emoji: "📊",
    color: "#0284C7",
    taskLabel: "Ingesting bank statements & payout calendars...",
    resultSummary: "13-week rolling radar initialized • ฿80,000 buffer active",
    status: "pending",
  },
  {
    id: "health",
    name: "Health Agent",
    role: "Financial Health & Credit Score",
    emoji: "🩺",
    color: "#2563EB",
    taskLabel: "Analyzing 7-factor hygiene & debt service coverage...",
    resultSummary: "Health score calculated: 78 / 100 (Grade B+ Prime)",
    status: "pending",
  },
  {
    id: "funding",
    name: "Funding Agent",
    role: "Working Capital & Terms",
    emoji: "💰",
    color: "#EAB308",
    taskLabel: "Evaluating credit line options & supplier deferral rates...",
    resultSummary: "Pre-screened 6 financing options • ¥100,000 terms matched",
    status: "pending",
  },
  {
    id: "collections",
    name: "Collections Agent",
    role: "Accounts Receivable Recovery",
    emoji: "🔔",
    color: "#EA580C",
    taskLabel: "Scanning overdue invoices & drafting friendly LINE reminders...",
    resultSummary: "Surfaced Boutique Siam (฿35,000) • 1 reminder queued",
    status: "pending",
  },
  {
    id: "true-cost",
    name: "True Cost Agent",
    role: "FX Corridors & APR Defense",
    emoji: "🔍",
    color: "#B91C1C",
    taskLabel: "Validating Shenzhen Chen Tech bank account & FX spreads...",
    resultSummary: "No tampering detected • Zero hidden predatory fees",
    status: "pending",
  },
  {
    id: "trust",
    name: "Trust Agent",
    role: "PDPA & Zero-Surprise Gatekeeper",
    emoji: "🛡️",
    color: "#0F172A",
    taskLabel: "Locking deterministic boundaries & immutable audit trail...",
    resultSummary: "3 approval cards created • Bank-grade biometric guards armed",
    status: "pending",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  // Stepper state: 1 = Bank, 2 = Channels, 3 = Provisioning
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");

  // Step 1: Bank state
  const [selectedBankId, setSelectedBankId] = useState<string>("partner-bank");
  const [showConsentSheet, setShowConsentSheet] = useState(false);
  const [isLinkingBank, setIsLinkingBank] = useState(false);
  const [bankToast, setBankToast] = useState<string | null>(null);

  // Step 2: Channels state
  const [channels, setChannels] = useState<ChannelOption[]>(INITIAL_CHANNELS);

  // Step 3: Provisioning sequence state
  const [agentList, setAgentList] = useState<ProvisioningAgent[]>(PROVISIONING_AGENTS);
  const [isProvisioningComplete, setIsProvisioningComplete] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
  }, [router]);

  // Handle Bank Selection click
  const handleOpenConsentSheet = () => {
    setShowConsentSheet(true);
  };

  // Confirming Bank Linkage (Triggers Trust Agent log + Toast)
  const handleConfirmBankConsent = async () => {
    setIsLinkingBank(true);
    const session = getSession();

    // Optionally log into audit log if token exists
    if (session?.token) {
      try {
        await fetch("/api/trust/audit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            agentId: "trust",
            action: `Bank linked: ${BANKS.find((b) => b.id === selectedBankId)?.name} (Read-Only 12-month scope)`,
            status: "DONE",
          }),
        }).catch(() => {});
      } catch {
        // Fallback gracefully
      }
    }

    setTimeout(async () => {
      if (typeof window !== "undefined") {
        localStorage.setItem("bizmate_selected_bank", selectedBankId);
        localStorage.setItem("bizmate_enabled_banks", JSON.stringify([selectedBankId]));
      }

      // Synchronize backend user business name to the newly linked bank's statement company
      if (session?.token) {
        try {
          await fetch("/api/financial/link-bank", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({ bankId: selectedBankId }),
          });
        } catch {
          // Fallback
        }
      }

      setIsLinkingBank(false);
      setShowConsentSheet(false);
      setBankToast("Bank account linked with verified Read-Only scope 👍");
      setTimeout(() => setBankToast(null), 3000);
      setSlideDirection("forward");
      setCurrentStep(2);
    }, 900);
  };

  // Toggle Channels
  const handleToggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  // Start Agent Provisioning sequence (ON-04)
  const handleStartProvisioning = () => {
    setSlideDirection("forward");
    setCurrentStep(3);

    // Sequential agent transitions:
    // Every 500ms, next agent transitions from pending -> working -> done
    let currentAgentIdx = 0;

    const interval = setInterval(() => {
      if (currentAgentIdx < PROVISIONING_AGENTS.length) {
        const idx = currentAgentIdx;
        setAgentList((prev) =>
          prev.map((a, i) => {
            if (i < idx) return { ...a, status: "done" };
            if (i === idx) return { ...a, status: "working" };
            return a;
          })
        );

        setTimeout(() => {
          setAgentList((prev) =>
            prev.map((a, i) => (i === idx ? { ...a, status: "done" } : a))
          );
        }, 500);

        currentAgentIdx++;
      } else {
        clearInterval(interval);
        setAgentList((prev) => prev.map((a) => ({ ...a, status: "done" })));
        setIsProvisioningComplete(true);
      }
    }, 700);
  };

  const selectedBank = BANKS.find((b) => b.id === selectedBankId) || BANKS[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent"
            >
              BizMate
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Skip to Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* Floating System Toast */}
      {bankToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span>🛡️</span>
          <span>{bankToast}</span>
        </div>
      )}

      {/* Stepper Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between text-xs font-bold">
          <div
            className={`flex items-center gap-2 transition-colors duration-300 ${
              currentStep >= 1
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-600"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-all duration-300 ${
                currentStep > 1
                  ? "bg-blue-600 text-white scale-100"
                  : currentStep === 1
                  ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-500 scale-105"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {currentStep > 1 ? "✓" : "1"}
            </span>
            <span>Bank Linkage</span>
          </div>

          <div
            className={`flex-1 h-0.5 mx-3 transition-all duration-500 ${
              currentStep > 1 ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-slate-800"
            }`}
          />

          <div
            className={`flex items-center gap-2 transition-colors duration-300 ${
              currentStep >= 2
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-600"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-all duration-300 ${
                currentStep > 2
                  ? "bg-blue-600 text-white scale-100"
                  : currentStep === 2
                  ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-500 scale-105"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {currentStep > 2 ? "✓" : "2"}
            </span>
            <span>Sales Channels</span>
          </div>

          <div
            className={`flex-1 h-0.5 mx-3 transition-all duration-500 ${
              currentStep > 2 ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-slate-800"
            }`}
          />

          <div
            className={`flex items-center gap-2 transition-colors duration-300 ${
              currentStep === 3
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-600"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-all duration-300 ${
                currentStep === 3
                  ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-500 scale-105"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              }`}
            >
              3
            </span>
            <span>Provisioning</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10">
        {/* ========================================================
            STEP 1: Bank Linkage (ON-02)
        ======================================================== */}
        {currentStep === 1 && (
          <div
            key="step-1"
            className={
              slideDirection === "backward"
                ? "animate-slide-in-left"
                : "animate-slide-in-right"
            }
          >
            <div className="mb-6">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                Step 1 of 3 • Financial Ingestion
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
                Link Your Operating Account
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Connect your business banking feed to activate the 13-week Cash Radar and safety buffer monitoring for <strong>{user?.businessName}</strong>.
              </p>
            </div>

            {/* Read-Only Guarantee Box */}
            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 mb-6 flex items-start gap-3 transition-transform hover:scale-[1.01]">
              <span className="text-xl">🛡️</span>
              <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                <strong className="block font-bold mb-0.5 text-blue-800 dark:text-blue-300">
                  Strictly Read-Only Guarantee (Trust Agent Enforced)
                </strong>
                BizMate cannot transfer money, debit funds, or alter credentials. Valid for 12 months under PDPA; revocable anytime in 1 tap.
              </div>
            </div>

            {/* Bank List */}
            <div className="space-y-3 mb-8">
              {BANKS.map((bank, index) => {
                const isSelected = selectedBankId === bank.id;
                const delayStyles = [
                  "animation-delay-[50ms]",
                  "animation-delay-[100ms]",
                  "animation-delay-[150ms]",
                  "animation-delay-[200ms]",
                ];
                return (
                  <div
                    key={bank.id}
                    onClick={() => setSelectedBankId(bank.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-0.5 animate-fade-in-up ${
                      delayStyles[index] || ""
                    } ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/25 shadow-md dark:shadow-none"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0 transition-transform duration-300 hover:scale-105">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={bank.logoUrl}
                          alt={bank.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {bank.name}
                          </p>
                          {bank.badge && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {bank.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {bank.desc}
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="bank_choice"
                      checked={isSelected}
                      onChange={() => setSelectedBankId(bank.id)}
                      className="w-4 h-4 text-blue-600 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Continue to Bottom Sheet Consent Button */}
            <button
              onClick={handleOpenConsentSheet}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Review Read-Only Scope with {selectedBank.code} →</span>
            </button>
          </div>
        )}

        {/* ========================================================
            STEP 2: Sales Channels Linkage (ON-03)
        ======================================================== */}
        {currentStep === 2 && (
          <div
            key="step-2"
            className={
              slideDirection === "backward"
                ? "animate-slide-in-left"
                : "animate-slide-in-right"
            }
          >
            <div className="mb-6">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                Step 2 of 3 • Omnichannel Telemetry
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
                Connect Sales Channels
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Toggle your revenue streams. Payouts feed the Cash Radar, while LINE OA unlocks owner-approved collection reminder dispatches.
              </p>
            </div>

            {/* Channels Matrix */}
            <div className="space-y-3 mb-8">
              {channels.map((channel, index) => {
                const delayStyles = [
                  "animation-delay-[50ms]",
                  "animation-delay-[100ms]",
                  "animation-delay-[150ms]",
                  "animation-delay-[200ms]",
                  "animation-delay-[250ms]",
                ];
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleToggleChannel(channel.id)}
                    className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between hover:-translate-y-0.5 animate-fade-in-up ${
                      delayStyles[index] || ""
                    } ${
                      channel.enabled
                        ? "border-blue-500/80 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 max-w-[80%]">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0 transition-transform duration-300 hover:scale-105">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={channel.logoUrl}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {channel.name}
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {channel.purpose}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {channel.description}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                        channel.enabled
                          ? "bg-blue-600 justify-end"
                          : "bg-slate-300 dark:bg-slate-700 justify-start"
                      }`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-300 transform scale-105" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA to start provisioning */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSlideDirection("backward");
                  setCurrentStep(1);
                }}
                className="py-4 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-bold text-xs text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStartProvisioning}
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Start my agents 🚀</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: Agent Provisioning Sequence (ON-04)
        ======================================================== */}
        {currentStep === 3 && (
          <div key="step-3" className="animate-slide-in-right">
            <div className="mb-6 text-center">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                Step 3 of 3 • Autonomous Team Activation
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
                Provisioning Your 6 Agents
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                Connecting financial data pipelines, calibrating risk models, and establishing zero-surprise boundaries.
              </p>
            </div>

            {/* Sequential Agent Rows */}
            <div className="space-y-3 mb-8">
              {agentList.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden ${
                    agent.status === "done"
                      ? "border-emerald-400 dark:border-emerald-800/80 bg-white dark:bg-slate-900 shadow-md dark:shadow-none translate-x-0"
                      : agent.status === "working"
                      ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-500/25 shadow-lg scale-[1.01] shimmer-active"
                      : "border-slate-200 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/30 opacity-40 translate-x-1"
                  }`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition-transform duration-300 ${
                          agent.status === "working"
                            ? "scale-110 shadow-md bg-blue-100 dark:bg-blue-900 border border-blue-400"
                            : agent.status === "done"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800"
                            : "bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60"
                        }`}
                      >
                        {agent.emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {agent.name}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">
                            {agent.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition-all duration-300">
                          {agent.status === "done"
                            ? agent.resultSummary
                            : agent.status === "working"
                            ? agent.taskLabel
                            : "Waiting in queue..."}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {agent.status === "done" && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
                          <span>Done</span>
                          <span>👍</span>
                        </span>
                      )}
                      {agent.status === "working" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span>Working...</span>
                        </span>
                      )}
                      {agent.status === "pending" && (
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-600">
                          Queued
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Primary Activation CTA */}
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.setItem("bizmate_bank_connected", "true");
                }
                router.push("/dashboard");
              }}
              disabled={!isProvisioningComplete}
              className={`w-full py-4 rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isProvisioningComplete
                  ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 transform hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-75"
              }`}
            >
              {isProvisioningComplete ? (
                <span>Meet your agents 👋 → Go to Dashboard</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  <span>Configuring financial agents...</span>
                </div>
              )}
            </button>
          </div>
        )}
      </main>

      {/* ========================================================
          BOTTOM SHEET MODAL: Explicit Read-Only Consent (ON-02)
      ======================================================== */}
      {showConsentSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => !isLinkingBank && setShowConsentSheet(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedBank.logoUrl}
                    alt={selectedBank.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Explicit Read-Only Scope
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Consent Agreement • {selectedBank.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowConsentSheet(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 4 PRD Mandated Consent Clauses */}
            <div className="space-y-3 my-5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">1.</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Account Balances &amp; History:</strong>
                  Ingests current balances and 12-month past transactions strictly to project Cash Radar.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">2.</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Account Identity:</strong>
                  Verifies registered business name and account numbers against corporate registration.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-rose-600 font-bold">3.</span>
                <div>
                  <strong className="text-rose-600 dark:text-rose-400 block">Strict Negative Scope:</strong>
                  BizMate <em>CANNOT</em> transfer funds, execute debits, or modify any account settings.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-blue-600 font-bold">4.</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Duration &amp; Revocability:</strong>
                  Valid for 12 months under Thailand PDPA. Revocable anytime with 1 tap in the Trust Agent menu.
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isLinkingBank}
                onClick={() => setShowConsentSheet(false)}
                className="w-1/3 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLinkingBank}
                onClick={handleConfirmBankConsent}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLinkingBank ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing Trust Grant...</span>
                  </>
                ) : (
                  <span>I Authorize Read-Only Feed →</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
