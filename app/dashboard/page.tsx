"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { getSession, clearSession, AuthUser } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

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

      setResetMessage("Database reset successfully to baseline demo state!");
      setShowConfirmModal(false);
      setTimeout(() => setResetMessage(null), 4000);
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
          <span className="text-sm font-semibold">Loading BizMate Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent"
            >
              BizMate
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {user?.businessName || "Your Company"}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {user?.email}
              </span>
            </div>

            <ThemeToggle />

            <button
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
              title="Reset database to demo baseline"
            >
              <span>⚡</span>
              <span>Dev Reset</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Preview */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Welcome Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <span className="text-xs font-mono uppercase tracking-widest text-blue-200 font-bold">
              Account Active • Authenticated
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
              Welcome, {user?.businessName}!
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-2">
              Your financial copilot session is secure. 6 autonomous agents are standing by under deterministic guardrails.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold text-xs shadow-md hover:bg-blue-50 transition-colors"
              >
                Configure Bank &amp; Channels →
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Radar</span>
              <span className="text-lg">📊</span>
            </div>
            <p className="text-2xl font-black mt-2 text-slate-900 dark:text-white">฿245,000</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
              +฿35,000 incoming via Boutique Siam
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Health Score</span>
              <span className="text-lg">🩺</span>
            </div>
            <p className="text-2xl font-black mt-2 text-slate-900 dark:text-white">78 / 100</p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
              Grade B+ • Prime Credit Eligible
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approval Inbox</span>
              <span className="text-lg">📥</span>
            </div>
            <p className="text-2xl font-black mt-2 text-slate-900 dark:text-white">3 Pending</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Zero-surprise actions awaiting your sign-off
            </p>
          </div>
        </div>

        {/* Developer Reset Success/Error Toast Banner */}
        {resetMessage && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
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
              <li>Re-seed 3 PRD Approval Inbox items</li>
              <li>Re-seed baseline Trust Agent audit logs</li>
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
    </div>
  );
}
