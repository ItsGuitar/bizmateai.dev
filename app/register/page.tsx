"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { saveSession } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPdpaModal, setShowPdpaModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanName = businessName.trim();
    if (!cleanName) {
      setError("Please enter your business or company name.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid work email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!agreeTerms) {
      setError("Please accept the PDPA Consent Terms to create your account.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account. Please try again.");
        setIsLoading(false);
        return;
      }

      saveSession(data.token, data.user, true);
      setSuccess("Account created successfully! Preparing your financial agents...");

      setTimeout(() => {
        router.push("/onboarding");
      }, 600);
    } catch (err) {
      console.error("Register client error:", err);
      setError("Failed to reach registration server. Please check your network.");
      setIsLoading(false);
    }
  };

  return (
    <div className="h-dvh h-screen w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative">
      {/* LEFT HALF: Full Bleed Artwork - No frame, no border */}
      <div className="hidden md:block md:w-1/2 h-full relative overflow-hidden bg-slate-950">
        <Image
          src="/images/auth-banner-register.jpg"
          alt="BizMate Financial Copilot Mascot"
          fill
          sizes="50vw"
          unoptimized
          className="object-cover object-center"
          priority
        />

        {/* Top Floating Branding */}
        <div className="absolute top-6 left-6 z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/70 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200/60 dark:border-white/10 shadow-sm group"
          >
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-xl font-black tracking-normal select-none bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity"
            >
              BizMate
            </span>
          </Link>
        </div>
      </div>

      {/* RIGHT HALF: Registration Form Section */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 overflow-y-auto relative">
        {/* Ambient background glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow delay-300" />

        {/* Top Header Row */}
        <div className="flex items-center justify-between w-full max-w-sm mx-auto shrink-0 relative z-10 animate-fade-in-up delay-100">
          {/* Logo on mobile view */}
          <Link href="/" className="md:hidden inline-flex items-center gap-1.5 group">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity"
            >
              BizMate
            </span>
          </Link>
          <div className="hidden md:block" />

          {/* Theme Toggle & Back Button */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Center Content: Register Box */}
        <div className="w-full max-w-sm mx-auto my-auto py-2 relative z-10">
          {/* Mobile Artwork Header - Frameless, no border */}
          <div className="md:hidden w-full h-28 relative overflow-hidden rounded-xl mb-3 animate-fade-in-scale delay-150">
            <Image
              src="/images/auth-banner-register.jpg"
              alt="BizMate Mascot"
              fill
              sizes="100vw"
              unoptimized
              className="object-cover object-center"
              priority
            />
          </div>

          <div className="mb-3 animate-fade-in-up delay-200">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Automate your finances
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Protect your working capital and track cash flow in under 2 minutes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5 animate-fade-in-up delay-300">
            {/* Error Message Alert */}
            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <span className="shrink-0 text-sm">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {success && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <span className="shrink-0 text-sm">✓</span>
                <span>{success}</span>
              </div>
            )}

            {/* Business Name Field */}
            <div>
              <label
                htmlFor="businessName"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Business / Company Name
              </label>
              <input
                id="businessName"
                type="text"
                required
                disabled={isLoading}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Ploy Select Co., Ltd."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:scale-[1.01] transition-all placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>

            {/* Work Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Work Email
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@company.com"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:scale-[1.01] transition-all placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Create Password
              </label>
              <input
                id="password"
                type="password"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:scale-[1.01] transition-all placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>

            {/* Terms & Privacy Consent */}
            <div className="flex items-start pt-0.5">
              <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  required
                  disabled={isLoading}
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                />
                <span className="leading-tight">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowPdpaModal(true)}
                    className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    PDPA Consent Terms
                  </button>{" "}
                  (read-only bank sync).
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Get started with BizMate →</span>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 animate-fade-in-up delay-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 ml-1 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="w-full max-w-sm mx-auto text-center text-[11px] text-slate-400 shrink-0 relative z-10 animate-fade-in-up delay-500">
          BizMate MSME Financial Copilot •{" "}
          <button
            type="button"
            onClick={() => setShowPdpaModal(true)}
            className="underline hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            PDPA B.E. 2562 Protected
          </button>
        </div>
      </div>

      {/* POPUP MODAL: Real PDPA Policy Modal */}
      {showPdpaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in-up">
          <div className="w-full max-w-xl max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-scale">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base">
                  🛡️
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    PDPA Consent &amp; Data Governance
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Compliant with Thailand PDPA B.E. 2562 (2019)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdpaModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body (Real Legal Text) */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {/* Highlight Box */}
              <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-blue-950 dark:text-blue-200">
                <strong className="block font-bold mb-1 text-blue-800 dark:text-blue-300">
                  🔒 Core Technical Guarantee: Strictly Read-Only
                </strong>
                BizMate operates under deterministic server guardrails. We can{" "}
                <strong>never initiate transfers, withdraw funds, or alter credentials</strong>. Bank and sales
                connections are strictly read-only for cash forecasting.
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  1. Data Controller &amp; Statutory Authority
                </h4>
                <p>
                  BizMate Financial Technologies (Thailand) Co., Ltd. (&quot;BizMate&quot;) acts as the Data Controller under
                  Sections 24 and 19 of Thailand PDPA B.E. 2562. You may contact our Data Protection Officer at{" "}
                  <span className="font-mono text-blue-600 dark:text-blue-400">dpo@bizmate.co</span>.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  2. Categories of Processed Data
                </h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Commercial Identity:</strong> Business name, Tax ID, authorized owner email, and phone.
                  </li>
                  <li>
                    <strong>Banking Feeds (Read-Only):</strong> Bank balances, historical ledger statements, and daily cash
                    inflows/outflows.
                  </li>
                  <li>
                    <strong>Sales Channel Feeds:</strong> Shopee, Lazada, TikTok Shop payout settlement reports, and PromptPay QR records.
                  </li>
                  <li>
                    <strong>Invoices &amp; AR Records:</strong> Due dates, amounts owed, and debtor payment history.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  3. Zero-Surprise Policy &amp; Approval Safeguards
                </h4>
                <p>
                  No customer reminders (via LINE OA or Email) are ever sent, and no financial data is ever shared with
                  third-party lenders, without your prior explicit review and approval in the Central Inbox (IB-01).
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  4. Your PDPA Rights &amp; 1-Tap Revocation
                </h4>
                <p>
                  Under PDPA Sections 30-36, you have the right to access, rectify, restrict processing, and revoke any
                  linked data source. All consents can be terminated with 1 tap directly in:
                </p>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-800 dark:text-slate-200 mt-1">
                  Dashboard → Trust Agent (TR-01) → Sharing Tab → [Revoke Access]
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  5. Bank-Grade Encryption
                </h4>
                <p>
                  Data is protected with TLS 1.3 in transit and AES-256 encryption at rest. Audit trails are logged
                  immutably in the Trust Agent ledger.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Link
                href="/pdpa"
                target="_blank"
                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold underline underline-offset-2 flex items-center gap-1"
              >
                <span>Read Full 6-Section Document</span>
                <span>↗</span>
              </Link>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowPdpaModal(false)}
                  className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgreeTerms(true);
                    setShowPdpaModal(false);
                  }}
                  className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all cursor-pointer"
                >
                  I Accept &amp; Agree
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
