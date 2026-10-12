"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { getSession, AuthUser } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("partner-bank");
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
  }, [router]);

  const handleLinkBank = () => {
    setIsLinking(true);
    setTimeout(() => {
      setIsLinking(false);
      router.push("/dashboard");
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
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
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              Skip to Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 py-12">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 text-xs font-bold text-slate-400">
          <span className="text-blue-600 dark:text-blue-400">Step 1 of 3: Bank Linkage</span>
          <span>Step 2: Sales Channels</span>
          <span>Step 3: Provision</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Link Your Operating Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Welcome, <strong>{user?.businessName}</strong>. Grant read-only access to power the 13-week Cash Radar and safety buffer alerts.
          </p>
        </div>

        {/* Read-Only Guarantee Box */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 mb-6 flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
            <strong className="block font-bold mb-0.5 text-blue-800 dark:text-blue-300">
              Strictly Read-Only Guarantee
            </strong>
            BizMate cannot transfer money, debit funds, or alter credentials. Valid for 12 months under PDPA; revocable anytime in 1 tap.
          </div>
        </div>

        {/* Bank Selection Options */}
        <div className="space-y-3 mb-8">
          <label
            onClick={() => setSelectedBank("partner-bank")}
            className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedBank === "partner-bank"
                ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                KB
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Partner Bank (Instant Sync)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automated statement ingest • Zero setup delay
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="bank"
              checked={selectedBank === "partner-bank"}
              onChange={() => setSelectedBank("partner-bank")}
              className="w-4 h-4 text-blue-600"
            />
          </label>

          <label
            onClick={() => setSelectedBank("scb")}
            className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedBank === "scb"
                ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm">
                SC
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Siam Commercial Bank
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Open Banking API • Read-Only
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="bank"
              checked={selectedBank === "scb"}
              onChange={() => setSelectedBank("scb")}
              className="w-4 h-4 text-blue-600"
            />
          </label>

          <label
            onClick={() => setSelectedBank("bbl")}
            className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedBank === "bbl"
                ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center font-black text-sm">
                BB
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Bangkok Bank
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Open Banking API • Read-Only
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="bank"
              checked={selectedBank === "bbl"}
              onChange={() => setSelectedBank("bbl")}
              className="w-4 h-4 text-blue-600"
            />
          </label>
        </div>

        {/* Action Button */}
        <button
          onClick={handleLinkBank}
          disabled={isLinking}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {isLinking ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Authorizing Read-Only Sync...</span>
            </>
          ) : (
            <span>Authorize &amp; Link Account →</span>
          )}
        </button>
      </main>
    </div>
  );
}
