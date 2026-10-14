"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { BankSettingsModal } from "@/app/components/BankSettingsModal";
import { getSession, clearSession, AuthUser } from "@/lib/auth-client";

interface InboxApprovalNotification {
  id: string;
  agentId: string;
  title: string;
  description: string;
  impact: string;
  status: string;
  requiresFaceId: boolean;
  createdAt?: string;
}

const AGENT_META: Record<string, { name: string; emoji: string; color: string }> = {
  collections: { name: "Collections Agent", emoji: "🔔", color: "#F97316" },
  funding: { name: "Funding Agent", emoji: "💰", color: "#EAB308" },
  "true-cost": { name: "True Cost Agent", emoji: "🔍", color: "#EF4444" },
  cash: { name: "Cash Agent", emoji: "📊", color: "#0284C7" },
  health: { name: "Health Agent", emoji: "🩺", color: "#2563EB" },
  trust: { name: "Trust Agent", emoji: "🛡️", color: "#6366F1" },
};

interface AppHeaderProps {
  user?: AuthUser | null;
  activeNav?: "dashboard" | "inbox" | "plan" | "docs";
  onDevReset?: () => void;
  isBankConnected?: boolean;
  onToggleBank?: () => void;
  selectedBank?: string;
  onSelectBank?: (bankId: string) => void;
}

export function AppHeader({
  user: initialUser,
  activeNav,
  onDevReset,
  isBankConnected,
  onToggleBank,
  selectedBank: controlledBank,
  onSelectBank,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(initialUser || null);
  const [currentBank, setCurrentBank] = useState<string>("kbank");
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
  const [activeBanksCount, setActiveBanksCount] = useState<number>(1);
  const [pendingApprovals, setPendingApprovals] = useState<InboxApprovalNotification[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [recentAuditLogs, setRecentAuditLogs] = useState<Array<{ id: string; agentId: string; action: string; status: string }>>([]);

  const notiRef = useRef<HTMLDivElement>(null);

  // Sync user from session if not provided
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    } else {
      const session = getSession();
      if (session?.user) {
        setUser(session.user);
      }
    }
  }, [initialUser]);

  // Fetch inbox approvals and audit logs
  const fetchNotifications = async () => {
    const session = getSession();
    if (!session?.token) return;

    try {
      const isBankConnectedState = typeof window !== "undefined" && localStorage.getItem("bizmate_bank_connected") === "true";
      const storedBankId = typeof window !== "undefined" ? localStorage.getItem("bizmate_selected_bank") || "" : "";
      // 1. Fetch pending approvals (only seeded if bank is connected)
      const inboxRes = await fetch(`/api/inbox?status=PENDING&bankConnected=${isBankConnectedState}&bankId=${storedBankId}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const inboxData = await inboxRes.json();
      if (inboxData?.items) {
        setPendingApprovals(inboxData.items);
        setPendingCount(inboxData.items.length);
      }

      // 2. Fetch latest audit logs for informational feed
      const auditRes = await fetch("/api/trust/audit", {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const auditData = await auditRes.json();
      if (auditData?.logs) {
        setRecentAuditLogs(auditData.logs.slice(0, 3));
      }
    } catch (err) {
      console.error("Failed to fetch notification items:", err);
    }
  };

  // Sync current bank with controlledBank or localStorage & listen for open settings event
  useEffect(() => {
    if (controlledBank) {
      setCurrentBank(controlledBank);
    } else if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bizmate_selected_bank") || "kbank";
      setCurrentBank(stored);
    }

    const handleOpenSettings = () => {
      setIsBankSettingsOpen(true);
    };

    window.addEventListener("bizmate_open_bank_settings", handleOpenSettings);
    return () => {
      window.removeEventListener("bizmate_open_bank_settings", handleOpenSettings);
    };
  }, [controlledBank]);

  const handleBankChange = (newBank: string) => {
    setCurrentBank(newBank);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_selected_bank", newBank);
      // Dispatch custom storage event for all listening components
      window.dispatchEvent(new Event("bizmate_bank_changed"));
    }
    if (onSelectBank) {
      onSelectBank(newBank);
    } else {
      // Reload or navigate to refresh data with the newly selected bank
      window.location.reload();
    }
  };

  // Close notifications popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }

    if (isNotiOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotiOpen]);

  const handleToggleNoti = () => {
    if (!isNotiOpen) {
      fetchNotifications();
    }
    setIsNotiOpen((prev) => !prev);
  };

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  const currentNav =
    activeNav ||
    (pathname === "/dashboard"
      ? "dashboard"
      : pathname === "/inbox"
      ? "inbox"
      : pathname.includes("/plan")
      ? "plan"
      : pathname.includes("/docs")
      ? "docs"
      : undefined);

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left Side: Logo & Primary Nav Links */}
        <div className="flex items-center gap-5 sm:gap-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 group shrink-0">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity"
            >
              BizMate<span className="text-blue-500 dark:text-cyan-400 text-base font-mono align-top ml-0.5">AI</span>
            </span>
          </Link>

          {/* Unified Primary Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-xl transition-all ${
                currentNav === "dashboard"
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/dashboard/cash"
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                pathname.includes("/cash")
                  ? "bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>Cash Radar</span>
            </Link>

            <Link
              href="/inbox"
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                currentNav === "inbox"
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>Inbox</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {pendingCount}
                </span>
              )}
            </Link>

            <Link
              href="/dashboard/plan"
              className={`px-3 py-1.5 rounded-xl transition-all ${
                currentNav === "plan"
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              Joint Plan
            </Link>

            <Link
              href="/dashboard/collections"
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                pathname.includes("/collections")
                  ? "bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>AR Ledger</span>
            </Link>

            <Link
              href="/dashboard/true-cost"
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                pathname.includes("/true-cost")
                  ? "bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>Risk &amp; Fee Shield</span>
            </Link>

            <Link
              href="/docs"
              className={`px-3 py-1.5 rounded-xl transition-all ${
                currentNav === "docs"
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              Docs
            </Link>
          </nav>
        </div>

        {/* Right Side: Bank Selector, Dev Reset, Theme, Notification Popover, User */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Universal Active Case / Linked Bank Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={currentBank}
              onChange={(e) => handleBankChange(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer shadow-2xs max-w-[155px] sm:max-w-none truncate"
              title="Switch Active Operating Statement Case"
            >
              <option value="kbank">KBANK: Ploy Select (Shenzhen Chen Tech)</option>
              <option value="scb">SCB: Apex Craft (Osaka Timber Mills)</option>
              <option value="bbl">BBL: BioHarvest (Heilongjiang AgroChem)</option>
              <option value="personal">Personal: Freelance Creator (3-Month)</option>
            </select>

            <button
              type="button"
              onClick={() => setIsBankSettingsOpen(true)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer text-xs flex items-center justify-center"
              title="Manage Bank Connections (Multi-Bank Aggregation)"
              aria-label="Bank Settings"
            >
              <span className="text-sm leading-none">⚙️</span>
            </button>
          </div>

          {/* Optional Developer Reset Button */}
          {onDevReset !== undefined && (
            <button
              onClick={onDevReset}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
              title="Reset database to demo baseline"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Dev Reset</span>
            </button>
          )}

          <ThemeToggle />

          {/* ========================================================
              NOTIFICATION BELL & INTERACTIVE POPOVER DROPDOWN
          ======================================================== */}
          <div className="relative" ref={notiRef}>
            <button
              onClick={handleToggleNoti}
              className={`relative p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                isNotiOpen
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
              }`}
              title="Notifications & Approval Alerts"
              aria-label="Open Notifications"
            >
              <span className="text-base">🔔</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Notification Popover Box */}
            {isNotiOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                {/* Popover Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Notifications
                    </span>
                    {pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        {pendingCount} Action{pendingCount > 1 ? "s" : ""} Required
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsNotiOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Notifications Feed List */}
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 space-y-1">
                  {/* Category 1: Items Requiring Inbox Approval */}
                  {pendingApprovals.length > 0 && (
                    <div className="px-2 py-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                        Approval Queue (Zero-Surprise)
                      </span>
                    </div>
                  )}

                  {pendingApprovals.map((item) => {
                    const agent = AGAGENT_META_HELPER(item.agentId);
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-50/90 dark:hover:bg-amber-950/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md transition-transform hover:scale-105"
                            style={{
                              backgroundColor: `${agent.color}15`,
                              color: agent.color,
                            }}
                          >
                            <span>{agent.emoji}</span>
                            <span>{agent.name}</span>
                          </span>

                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                            {item.requiresFaceId ? "🔐 Face ID" : "Sign-Off"}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        </div>

                        <div className="pt-1 flex items-center justify-between border-t border-amber-200/40 dark:border-amber-900/30 text-[11px]">
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                            {item.impact}
                          </span>

                          {/* ACTION BUTTON: OPEN IN INBOX */}
                          <Link
                            href={`/inbox?item=${item.agentId}`}
                            onClick={() => setIsNotiOpen(false)}
                            className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:scale-105 active:scale-95 transition-all duration-150"
                          >
                            <span>Open in Inbox</span>
                            <span>→</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {/* Category 2: Recent Agent Telemetry / Activity */}
                  <div className="px-2 pt-3 pb-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                      Recent Activity &amp; Protection
                    </span>
                  </div>

                  {recentAuditLogs.map((log) => {
                    const agent = AGAGENT_META_HELPER(log.agentId);
                    return (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-xs flex items-start gap-2.5"
                      >
                        <span className="text-sm mt-0.5">{agent.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                            {log.action}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                            {log.status === "DONE" ? "Verified" : log.status} • {agent.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {pendingApprovals.length === 0 && recentAuditLogs.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      <span>✓ All notifications and approvals caught up!</span>
                    </div>
                  )}
                </div>

                {/* Popover Footer: Primary Gateway to Inbox */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Zero-Surprise Policy Active
                  </span>
                  <Link
                    href="/inbox"
                    onClick={() => setIsNotiOpen(false)}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>View all in Inbox</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Menu */}
          <UserProfileMenu
            user={user}
            onLogout={handleLogout}
            showAccountModal={() => router.push("/dashboard")}
            onOpenBankSettings={() => setIsBankSettingsOpen(true)}
          />
        </div>
      </div>
    </header>

    {/* Multi-Bank Settings Modal rendered outside sticky header */}
    <BankSettingsModal
      isOpen={isBankSettingsOpen}
      onClose={() => setIsBankSettingsOpen(false)}
      onSettingsChanged={() => {
        fetchNotifications();
        if (onSelectBank) {
          onSelectBank(currentBank);
        }
      }}
    />
  </>
  );
}

function AGAGENT_META_HELPER(agentId: string) {
  return AGENT_META[agentId.toLowerCase()] || AGENT_META.trust;
}
