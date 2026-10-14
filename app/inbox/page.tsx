"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, clearSession, AuthUser } from "@/lib/auth-client";

interface InboxItem {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  description: string;
  impact: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  requiresFaceId: boolean;
  createdAt: string;
}

interface AgentMetadata {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: string;
  badge: string;
}

const AGENTS_MAP: Record<string, AgentMetadata> = {
  collections: {
    id: "collections",
    name: "Collections Agent",
    emoji: "🔔",
    color: "#F97316",
    role: "Smart AR Follow-ups",
    badge: "Automated",
  },
  funding: {
    id: "funding",
    name: "Funding Agent",
    emoji: "💰",
    color: "#EAB308",
    role: "Working Capital & Terms",
    badge: "1.1% Rate",
  },
  "true-cost": {
    id: "true-cost",
    name: "True Cost Agent",
    emoji: "🔍",
    color: "#EF4444",
    role: "APR & Fraud Shield",
    badge: "Protected",
  },
  cash: {
    id: "cash",
    name: "Cash Agent",
    emoji: "📊",
    color: "#0284C7",
    role: "13-Week Cash Radar",
    badge: "Radar Live",
  },
  health: {
    id: "health",
    name: "Health Agent",
    emoji: "🩺",
    color: "#2563EB",
    role: "Financial Health Score",
    badge: "Grade B+",
  },
  trust: {
    id: "trust",
    name: "Trust Agent",
    emoji: "🛡️",
    color: "#6366F1",
    role: "Security Gatekeeper",
    badge: "Enforced",
  },
};

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<{ pending: number; approved: number; declined: number; all: number }>({
    pending: 0,
    approved: 0,
    declined: 0,
    all: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "DECLINED" | "ALL">("PENDING");
  const [agentFilter, setAgentFilter] = useState<string>("ALL");

  // Inspection modal state
  const [inspectingItem, setInspectingItem] = useState<InboxItem | null>(null);
  const [collectionsTone, setCollectionsTone] = useState<"friendly" | "firm">("friendly");

  // Biometric Face ID modal state
  const [faceIdModalItem, setFaceIdModalItem] = useState<InboxItem | null>(null);
  const [faceIdStep, setFaceIdStep] = useState<"ready" | "scanning" | "success" | "failed">("ready");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const [financialSummary, setFinancialSummary] = useState<any>(null);

  // Fetch session & inbox items
  const loadInboxItems = async (token: string, currentStatus = statusFilter) => {
    try {
      const isBankConnectedState = typeof window !== "undefined" && localStorage.getItem("bizmate_bank_connected") === "true";
      const storedBankChoice = typeof window !== "undefined" ? localStorage.getItem("bizmate_selected_bank") || "kbank" : "kbank";
      let effectiveQuery = `bankId=${storedBankChoice}`;
      if (typeof window !== "undefined") {
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

      const res = await fetch(`/api/inbox?status=${currentStatus}&bankConnected=${isBankConnectedState}&${effectiveQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
      if (data.counts) {
        setStatusCounts(data.counts);
      }

      // Fetch dynamic financial summary for active bank(s)
      fetch(`/api/financial/summary?${effectiveQuery}`)
        .then((r) => r.json())
        .then((s) => setFinancialSummary(s))
        .catch(() => {});
    } catch (err) {
      console.error("Failed to load inbox items:", err);
      showToast("Failed to sync inbox items", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session?.token) {
      router.push("/login");
      return;
    }
    setUser(session.user);
    loadInboxItems(session.token, statusFilter);
  }, [router, statusFilter]);

  // Handle URL item parameter (e.g. ?item=collections)
  useEffect(() => {
    const itemParam = searchParams.get("item");
    if (itemParam && items.length > 0) {
      const target = items.find(
        (i) => i.agentId.toLowerCase() === itemParam.toLowerCase() || i.id === itemParam
      );
      if (target) {
        setInspectingItem(target);
      }
    }
  }, [searchParams, items]);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  // Perform action: APPROVE or DECLINE
  const executeAction = async (itemId: string, action: "APPROVE" | "DECLINE", biometricVerified = false) => {
    const session = getSession();
    if (!session?.token) return;

    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          itemId,
          action,
          biometricVerified,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to execute action");
      }

      showToast(
        action === "APPROVE"
          ? `Action approved successfully. Logged to Trust Agent audit ledger.`
          : `Action declined. Dispatches permanently blocked.`,
        "success"
      );

      // Close modals
      setInspectingItem(null);
      setFaceIdModalItem(null);
      setFaceIdStep("ready");

      // Reload list
      await loadInboxItems(session.token, statusFilter);
    } catch (err: any) {
      console.error("Error executing action:", err);
      showToast(err.message || "An error occurred", "error");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Trigger approval flow
  const handleApproveClick = (item: InboxItem) => {
    if (item.requiresFaceId) {
      setFaceIdModalItem(item);
      setFaceIdStep("ready");
    } else {
      executeAction(item.id, "APPROVE", false);
    }
  };

  // Start biometric simulation
  const handleStartFaceIdScan = () => {
    setFaceIdStep("scanning");
    setTimeout(() => {
      setFaceIdStep("success");
      setTimeout(() => {
        if (faceIdModalItem) {
          executeAction(faceIdModalItem.id, "APPROVE", true);
        }
      }, 900);
    }, 1800);
  };

  // Filter items by agent if specified
  const filteredItems = items.filter((item) => {
    if (agentFilter === "ALL") return true;
    return item.agentId.toLowerCase() === agentFilter.toLowerCase();
  });

  const pendingCount = statusCounts.pending;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col pb-20">
      {/* Universal Top Navigation Header */}
      <AppHeader user={user} activeNav="inbox" />

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2 border ${
              toastMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : toastMessage.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                : "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>{toastMessage.type === "success" ? "✅" : toastMessage.type === "error" ? "⚠️" : "ℹ️"}</span>
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 hover:opacity-75 cursor-pointer text-slate-500"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Banner: Zero-Surprise Policy */}
        <section className="mb-8">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden animate-fade-in-up duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                    Deterministic Guardrails Active
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>🛡️</span>
                    <span>Zero-Surprise Policy</span>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Central Approval Queue
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                  Every outgoing reminder, cross-border payment, and supplier negotiation prepared by your agents
                  requires your sign-off before leaving BizMateAI. No surprises, no opaque executions.
                </p>
              </div>

              {/* Status Metric Pills */}
              <div className="flex sm:flex-col gap-2 shrink-0">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-right transition-transform hover:scale-105 duration-200">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Pending Sign-Off</span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    {pendingCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-right transition-transform hover:scale-105 duration-200">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Biometric Lock</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-end gap-1 font-mono">
                    <span>🔐</span>
                    <span>Face ID Armed</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Data Lineage Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
              <span className="flex items-center gap-1.5">
                <span>⚡</span>
                <span>Uses Kasikornbank Main, AR Ledger & Trade Registry</span>
              </span>
              <span>Updated Reference: 12 Oct 2026, 09:41 AM ICT</span>
            </div>
          </div>
        </section>

        {/* Filter Bar */}
        <section className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up delay-100 duration-500">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs">
            {[
              { key: "PENDING", label: "Pending Sign-Off", count: statusCounts.pending },
              { key: "APPROVED", label: "Approved History", count: statusCounts.approved },
              { key: "DECLINED", label: "Declined", count: statusCounts.declined },
              { key: "ALL", label: "All Items", count: statusCounts.all },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] ${
                  statusFilter === tab.key
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                    statusFilter === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Agent Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden lg:inline">Filter Agent:</span>
            {[
              { id: "ALL", label: "All Agents", emoji: "🤖" },
              { id: "collections", label: "Collections", emoji: "🔔" },
              { id: "funding", label: "Funding", emoji: "💰" },
              { id: "true-cost", label: "True Cost", emoji: "🔍" },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setAgentFilter(chip.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-[1.03] active:scale-[0.98] ${
                  agentFilter === chip.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{chip.emoji}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Approvals List Queue */}
        <section className="space-y-4">
          {isLoading ? (
            /* Loading Skeleton */
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-4"
                >
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded w-2/3" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-800/40 rounded w-full" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            /* Empty State */
            <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center animate-fade-in-up duration-400">
              {typeof window !== "undefined" && localStorage.getItem("bizmate_bank_connected") !== "true" ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mb-4">
                    🔒
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bank Connection Required
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
                    AI agents have not analyzed your financial statements yet. Once your operating bank is connected,
                    Collections, Funding, and True Cost agents will surface actionable proposals here.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Link
                      href="/onboarding"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all hover:scale-105 shadow-xs"
                    >
                      Connect Bank Account →
                    </Link>
                    <Link
                      href="/dashboard"
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-105"
                    >
                      Return to Dashboard
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mb-4 animate-bounce">
                    🎉
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    All Caught Up!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
                    No items matching your filter. Your 6 autonomous agents continue monitoring cash feeds and accounts
                    receivable in the background under strict Zero-Surprise guardrails.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Link
                      href="/dashboard"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all hover:scale-105"
                    >
                      Return to Dashboard
                    </Link>
                    <Link
                      href="/dashboard/plan"
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-105"
                    >
                      Review Joint Plan
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Item Cards with Staggered Fade-in-up */
            filteredItems.map((item, idx) => {
              const agent = AGENTS_MAP[item.agentId.toLowerCase()] || AGENTS_MAP.trust;
              const isPending = item.status === "PENDING";
              const isApproved = item.status === "APPROVED";
              const isDeclined = item.status === "DECLINED";
              const delayClass =
                idx === 0 ? "delay-100" : idx === 1 ? "delay-200" : idx === 2 ? "delay-300" : "delay-400";

              return (
                <div
                  key={item.id}
                  className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1 animate-fade-in-up ${delayClass} ${
                    isPending
                      ? "border-slate-200 dark:border-slate-800"
                      : isApproved
                      ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : "border-slate-200 dark:border-slate-800 opacity-75"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    {/* Left: Originating Agent & Description */}
                    <div className="space-y-3 flex-1">
                      {/* Agent Chip & Trust Tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Originating Agent Chip */}
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: `${agent.color}15`,
                            color: agent.color,
                            border: `1px solid ${agent.color}35`,
                          }}
                        >
                          <span>{agent.emoji}</span>
                          <span>{agent.name}</span>
                        </div>

                        {/* Checked by Trust Agent Tag */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <span>🛡️</span>
                          <span>Checked by Trust Agent</span>
                        </span>

                        {/* Face ID Tag if required */}
                        {item.requiresFaceId && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <span>🔐</span>
                            <span>Face ID Required</span>
                          </span>
                        )}

                        {/* Status Tag */}
                        {!isPending && (
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              isApproved
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                            }`}
                          >
                            {isApproved ? "Approved & Executed" : "Declined by Owner"}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Cash Flow Impact Box */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📈</span>
                          <div>
                            <span className="font-mono text-[10px] uppercase text-slate-400 block">
                              Cash Radar Impact
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.impact}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Right: Tri-State Actions (Approve, Review, Decline) */}
                    <div className="lg:w-72 shrink-0 flex flex-col justify-between gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      {isPending ? (
                        <div className="space-y-2">
                          {/* Approve Button */}
                          <button
                            onClick={() => handleApproveClick(item)}
                            disabled={isProcessingAction}
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              item.requiresFaceId
                                ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/20"
                                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                            }`}
                          >
                            <span>{item.requiresFaceId ? "🔐" : "✓"}</span>
                            <span>
                              {item.requiresFaceId ? "Authorize via Face ID" : "Approve & Execute"}
                            </span>
                          </button>

                          {/* Review Details Button */}
                          <button
                            onClick={() => setInspectingItem(item)}
                            className="w-full py-2 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>🔍</span>
                            <span>Review Draft & Details</span>
                          </button>

                          {/* Decline Button */}
                          <button
                            onClick={() => executeAction(item.id, "DECLINE")}
                            disabled={isProcessingAction}
                            className="w-full py-1.5 px-3 rounded-xl text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-center"
                          >
                            Decline Action
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 text-center">
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 block">
                            Audit status: {item.status}
                          </span>
                          <button
                            onClick={() => setInspectingItem(item)}
                            className="mt-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            View Record Details →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* ========================================================
          REVIEW INSPECTION BOTTOM SHEET / MODAL
          (Granular preview of messages, supplier contracts, FX rails)
      ======================================================== */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{
                    backgroundColor: `${AGENTS_MAP[inspectingItem.agentId.toLowerCase()]?.color || "#6366F1"}20`,
                  }}
                >
                  {AGENTS_MAP[inspectingItem.agentId.toLowerCase()]?.emoji || "🤖"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {AGENTS_MAP[inspectingItem.agentId.toLowerCase()]?.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Verified Trace
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {inspectingItem.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setInspectingItem(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Contextual per Agent */}
            <div className="py-5 space-y-5">
              {/* Dynamic Context Variables */}
              {(() => {
                const debtor = financialSummary?.buyerHabits?.[0];
                const supplier = financialSummary?.supplierHistory;
                const companyName = financialSummary?.company || "Your Business";
                const safetyBuffer = financialSummary?.safetyBuffer || 80000;
                const supplierName = supplier?.name || "Verified Trade Supplier";
                const pendingAmt = supplier?.pendingOrderAmount || 100000;
                const pendingCurr = supplier?.pendingOrderCurrency || "¥";
                const pendingThb = supplier?.pendingOrderThb || Math.round(pendingAmt * 4.825);
                const debtorName = debtor?.name || "Corporate Client";
                const overdueAmt = debtor?.currentOverdueAmount || 35000;

                return (
                  <>
                    {/* Context 1: Collections Agent (Smart AR Follow-up) */}
                    {inspectingItem.agentId.toLowerCase() === "collections" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs pb-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Tone Strategy:</span>
                          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setCollectionsTone("friendly")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                collectionsTone === "friendly"
                                  ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs font-bold"
                                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              🤝 Polite &amp; Friendly
                            </button>
                            <button
                              type="button"
                              onClick={() => setCollectionsTone("firm")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                collectionsTone === "firm"
                                  ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs font-bold"
                                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              ⚖️ Formal &amp; Firm
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Channel: Verified LINE Official Account</span>
                            <span>Target: {debtorName}</span>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-1">
                              Thai LINE Message Preview
                            </span>
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                              {collectionsTone === "friendly"
                                ? `สวัสดีครับทีม ${debtorName} 🙏 จาก ${companyName} ครับ ขออนุญาตติดตามเอกสารแจ้งหนี้คงค้างยอด ฿${overdueAmt.toLocaleString()} ครับ หากโอนชำระเรียบร้อยแล้วสามารถส่งสลิปแจ้งได้เลยนะครับ ขอบพระคุณมากครับ`
                                : `เรียน ฝ่ายบัญชีและการเงิน ${debtorName} ทาง ${companyName} ขอแจ้งเตือนยอดค้างชำระ ฿${overdueAmt.toLocaleString()} เกินกำหนดแล้ว เพื่อคงสิทธิเครดิตเทอมทางการค้า รบกวนชำระเงินตามช่องทางปกติ ขอบคุณครับ`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Context 2: Funding Agent (Supplier Terms) */}
                    {inspectingItem.agentId.toLowerCase() === "funding" && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-bold text-yellow-800 dark:text-yellow-300">
                              Supplier: {supplierName}
                            </span>
                            <span className="font-mono text-yellow-700 dark:text-yellow-400 font-bold">
                              1.1% Capital Cost
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                            <div>Current Due: 26 Oct 2026</div>
                            <div className="text-right text-rose-600 font-bold">Threatens ฿{(safetyBuffer / 1000).toFixed(0)}k Buffer</div>
                            <div>Proposed Due: 25 Dec 2026</div>
                            <div className="text-right text-emerald-600 font-bold">+60 Days Deferral</div>
                            <div>Financing Fee: {pendingCurr}{Math.round(pendingAmt * 0.011).toLocaleString()} (~฿{Math.round(pendingThb * 0.011).toLocaleString()})</div>
                            <div className="text-right text-slate-900 dark:text-white">Partner Export Credit</div>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 pt-2 border-t border-yellow-200/60 dark:border-yellow-900/40">
                            <strong>AI Trade Rationale:</strong> Backed by verified transaction history. 1.1% fee outperforms commercial bank overdraft loans and preserves buffer liquidity.
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Routing: Supplier Official Channel</span>
                            <span>Bilingual Negotiation Draft</span>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-1">
                              Formal Proposal Draft (To {supplierName})
                            </span>
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                              Regarding order payment {pendingCurr}{pendingAmt.toLocaleString()} due 26 Oct 2026: {companyName} requests a 60-day credit term extension to 25 Dec 2026 under trade partner export credit facility, covering 1.1% deferral fee ({pendingCurr}{Math.round(pendingAmt * 0.011).toLocaleString()}).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Context 3: True Cost Agent (Verified FX Rail) */}
                    {inspectingItem.agentId.toLowerCase() === "true-cost" && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                              <span>🛡️</span>
                              <span>Verified Payee Shield: Verified Corporate Rail</span>
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              100% Authentic Registry
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                            <div>Beneficiary: {supplierName}</div>
                            <div className="text-right text-slate-900 dark:text-white font-bold">{pendingCurr}{pendingAmt.toLocaleString()}</div>
                            <div>Verification: Bank Registry Match</div>
                            <div className="text-right text-slate-900 dark:text-white font-bold">฿{pendingThb.toLocaleString()} THB</div>
                            <div>Anti-Phishing: Audit Verified</div>
                            <div className="text-right text-emerald-600 font-bold">Saves SWIFT Surcharge</div>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/40">
                            <strong>Anti-Fraud Verification:</strong> Recipient account audited against historical statement records. No phishing, invoice tampering, or unauthorized modifications detected.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-3">
                          <span className="text-2xl">🔐</span>
                          <div>
                            <p className="font-bold">Server-Enforced Biometric Step-Up</p>
                            <p className="text-[11px] opacity-80 mt-0.5">
                              High-value supplier disbursements require Face ID biometric authentication before dispatch to the bank clearing system.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Trust Agent Verification Footer */}
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Guardrail Axiom: Explainable Glass-Box AI</span>
                <span>Deterministic Server Enforcement</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setInspectingItem(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel / Close
              </button>

              {inspectingItem.status === "PENDING" && (
                <>
                  <button
                    onClick={() => {
                      executeAction(inspectingItem.id, "DECLINE");
                    }}
                    disabled={isProcessingAction}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  >
                    Decline Action
                  </button>

                  <button
                    onClick={() => {
                      handleApproveClick(inspectingItem);
                    }}
                    disabled={isProcessingAction}
                    className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      inspectingItem.requiresFaceId
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    <span>{inspectingItem.requiresFaceId ? "🔐" : "✓"}</span>
                    <span>
                      {inspectingItem.requiresFaceId
                        ? "Confirm with Face ID"
                        : "Approve & Execute Now"}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BIOMETRIC FACE ID STEP-UP MODAL (PRD Section 6 #3)
      ======================================================== */}
      {faceIdModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 sm:p-8 text-center shadow-2xl relative animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-300">
            {/* Sensor & Animation Visual */}
            <div className="my-4 flex flex-col items-center justify-center">
              <div className="relative w-28 h-28 rounded-full border-4 border-dashed border-indigo-500/40 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                {faceIdStep === "scanning" && (
                  <>
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-spin border-t-transparent" />
                    {/* Animated Laser Scanning Beam */}
                    <div className="absolute left-2 right-2 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-scan-beam pointer-events-none z-10" />
                  </>
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
                  {faceIdStep === "success" ? (
                    <span className="animate-check-pop">✓</span>
                  ) : (
                    <span className={faceIdStep === "scanning" ? "animate-pulse" : "animate-float"}>👤</span>
                  )}
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
                  ? `Required by Trust Agent for authorizing ${faceIdModalItem.title}.`
                  : faceIdStep === "scanning"
                  ? "Verifying facial biometric tokens against secure enclave..."
                  : "Biometric step-up passed. Dispatched to bank clearing."}
              </p>
            </div>

            {/* Transaction Impact Preview */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs font-mono text-slate-600 dark:text-slate-400 mb-6">
              <span className="text-[10px] uppercase text-slate-400 block">Outflow Amount</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {faceIdModalItem.impact}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {faceIdStep === "ready" && (
                <>
                  <button
                    onClick={handleStartFaceIdScan}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                  >
                    Authenticate with Face ID
                  </button>

                  {/* Fallback Option (PRD Section 6 #3: Decoupling for mock testing) */}
                  <button
                    onClick={() => {
                      executeAction(faceIdModalItem.id, "APPROVE", true);
                    }}
                    className="w-full py-2 px-4 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Passcode Fallback (Dev/Test Approval)
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setFaceIdModalItem(null);
                  setFaceIdStep("ready");
                }}
                disabled={faceIdStep === "scanning"}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold">Loading Central Approval Inbox...</span>
          </div>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
