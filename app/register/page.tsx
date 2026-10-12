"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export default function RegisterPage() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Creating account for ${businessName} (${email})... (Frontend layout complete)`);
  };

  return (
    <div className="h-dvh h-screen w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
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
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Ploy Select Co., Ltd."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:scale-[1.01] transition-all placeholder:text-slate-400"
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@company.com"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:scale-[1.01] transition-all placeholder:text-slate-400"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:scale-[1.01] transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Terms & Privacy Consent */}
            <div className="flex items-start pt-0.5">
              <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                />
                <span className="leading-tight">
                  I agree to the{" "}
                  <a
                    href="#terms"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Terms & PDPA Policy");
                    }}
                    className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold underline underline-offset-2"
                  >
                    PDPA Consent Terms
                  </a>{" "}
                  (read-only bank sync).
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              Get started with BizMate →
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
          BizMate MSME Financial Copilot • Zero-Surprise Policy Enforced
        </div>
      </div>
    </div>
  );
}
