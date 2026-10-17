"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { SearchableSelect } from "@/app/components/SearchableSelect";
import { getSession } from "@/lib/auth-client";
import { BUSINESS_TYPES } from "@/app/data/business-types";
import { COUNTRIES } from "@/app/data/countries";
import { SALES_CHANNELS } from "@/app/data/sales-channels";

const MONTHLY_SALES_RANGES = [
  "Under ฿50,000",
  "฿50,000 - ฿100,000",
  "฿100,000 - ฿500,000",
  "฿500,000 - ฿1,000,000",
  "Over ฿1,000,000",
];
const CURRENT_YEAR = new Date().getFullYear();
const TRADING_SINCE_YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i);

export default function OnboardingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const [businessName, setBusinessName] = useState("");
  const [juristicId, setJuristicId] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [tradingSince, setTradingSince] = useState("");
  const [whatYouSell, setWhatYouSell] = useState("");
  const [whereYouSell, setWhereYouSell] = useState<string[]>([]);
  const [mainSupplierCountry, setMainSupplierCountry] = useState("");
  const [monthlySalesRange, setMonthlySalesRange] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setBusinessName(session.user.businessName || "");
    setIsChecking(false);
  }, [router]);

  const toggleChannel = (channel: string) => {
    setWhereYouSell((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = businessName.trim();
    if (!cleanName) {
      setError("Please enter your business name.");
      return;
    }

    if (juristicId && !/^\d{13}$/.test(juristicId.trim())) {
      setError("Juristic ID must be exactly 13 digits.");
      return;
    }

    if (!businessType) {
      setError("Please select the type of business.");
      return;
    }

    if (!whatYouSell.trim()) {
      setError("Please tell us what you sell.");
      return;
    }

    if (whereYouSell.length === 0) {
      setError("Please select at least one place where you sell.");
      return;
    }

    if (!monthlySalesRange) {
      setError("Please select your approximate monthly sales.");
      return;
    }

    setIsLoading(true);

    try {
      const session = getSession();
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({
          businessName: cleanName,
          juristicId: juristicId.trim() || null,
          businessType,
          tradingSince: tradingSince ? parseInt(tradingSince, 10) : null,
          whatYouSell: whatYouSell.trim(),
          whereYouSell,
          mainSupplierCountry: mainSupplierCountry.trim() || null,
          monthlySalesRange,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save your business details. Please try again.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Business profile save error:", err);
      setError("Failed to reach the server. Please check your network.");
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return null;
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50";
  const labelClass =
    "block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1";

  return (
    <div className="h-dvh h-screen w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative">
      {/* LEFT HALF: Branding / Context Panel */}
      <div className="hidden lg:flex lg:w-[38%] h-full relative overflow-hidden bg-slate-900 dark:bg-slate-950 flex-col justify-between p-12 text-white">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 shadow-sm group">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-2xl font-black tracking-normal select-none bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-300 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity"
            >
              Biz<span className="text-sky-400">Mate</span><span className="text-blue-400 text-lg font-mono align-top ml-0.5">AI</span>
            </span>
          </Link>
        </div>

        <div className="relative z-10 max-w-sm space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-semibold">
            <span>One-time setup</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight leading-snug">
            Tell us about your business
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed font-normal">
            This helps the agents compare you with similar businesses and pick the right lenders,
            payment terms, and risk checks for you. You can change any of this later from Account
            Settings.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          Bank-Grade Security • Read-Only Telemetry • PDPA Compliant
        </div>
      </div>

      {/* RIGHT HALF: Form Section */}
      <div className="w-full lg:w-[62%] h-full flex flex-col overflow-y-auto relative">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow delay-300" />

        {/* Top Bar (mobile logo + theme toggle) */}
        <div className="flex items-center justify-between w-full max-w-3xl mx-auto px-4 sm:px-8 pt-6 shrink-0 relative z-10">
          <Link href="/" className="lg:hidden inline-flex items-center gap-1.5 group">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity"
            >
              Biz<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
              <span className="text-blue-500 text-sm font-mono align-top ml-0.5">AI</span>
            </span>
          </Link>
          <div className="hidden lg:block" />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 relative z-10">
          <div className="mb-6 animate-fade-in-up flex items-center gap-3 sm:gap-4">
            <Image
              src="/images/bot01.png"
              alt=""
              width={64}
              height={64}
              className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-md select-none pointer-events-none"
              priority
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Tell us about your business
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                This helps the agents compare you with similar businesses and pick the right lenders.
                You can change it later.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 sm:p-8 space-y-5 animate-fade-in-up delay-100"
          >
            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <span className="shrink-0 text-sm">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Business Name + Juristic ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Business name</label>
                <input
                  type="text"
                  required
                  disabled={isLoading}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Ploy Select Co., Ltd."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Juristic ID (13 digits)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  disabled={isLoading}
                  value={juristicId}
                  onChange={(e) => setJuristicId(e.target.value.replace(/\D/g, ""))}
                  placeholder="0105564012345"
                  className={`${inputClass} font-mono`}
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  We verify this with your business registry.
                </p>
              </div>
            </div>

            {/* Type of Business + Trading Since */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Type of business</label>
                <select
                  required
                  disabled={isLoading}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Trading since</label>
                <select
                  disabled={isLoading}
                  value={tradingSince}
                  onChange={(e) => setTradingSince(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Select a year</option>
                  {TRADING_SINCE_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* What do you make + Main Suppliers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>What do you make?</label>
                <input
                  type="text"
                  required
                  disabled={isLoading}
                  value={whatYouSell}
                  onChange={(e) => setWhatYouSell(e.target.value)}
                  placeholder="e.g. Precision metal parts for automotive buyers"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Main material suppliers are in</label>
                <SearchableSelect
                  options={COUNTRIES}
                  value={mainSupplierCountry}
                  onChange={setMainSupplierCountry}
                  placeholder="Search for a country..."
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Who do you sell to */}
            <div>
              <label className={`${labelClass} mb-2`}>Who do you sell to?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SALES_CHANNELS.map((channel) => {
                  const checked = whereYouSell.includes(channel);
                  return (
                    <label
                      key={channel}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                        checked
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isLoading}
                        checked={checked}
                        onChange={() => toggleChannel(channel)}
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                      />
                      <span>{channel}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Monthly Sales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Monthly sales (about)</label>
                <select
                  required
                  disabled={isLoading}
                  value={monthlySalesRange}
                  onChange={(e) => setMonthlySalesRange(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="" disabled>
                    Select a range
                  </option>
                  {MONTHLY_SALES_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:block" />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save & continue →</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
