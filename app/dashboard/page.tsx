"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { buildAiContext, stripFunctions } from "@/lib/ai-context";
import {
  COMPANY,
  HEALTH,
  VITALS,
  FACTORY,
  RANKED_ISSUES,
  BIGGEST_MOVES,
  PAST_12_MONTHS,
  CASH_WEEKS,
} from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import {
  CoinIcon,
  LeafIcon,
  ShieldIcon,
  PulseIcon,
  BankIcon,
} from "@/app/components/icons";
import type { PipelineOutput } from "@/lib/calculation-pipeline";

const LOGICAL_WIDTH = 1000;
const CHART_HEIGHT = 240;

function formatCompactMoney(n: number) {
  if (n >= 1_000_000) return `${COMPANY.currency}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${COMPANY.currency}${(n / 1_000).toFixed(0)}K`;
  return `${COMPANY.currency}${n}`;
}

function formatMoney(n: number) {
  return `${COMPANY.currency}${n.toLocaleString()}`;
}

function getGreeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

const HEALTH_BAR_COLOR: Record<string, string> = {
  Thriving: "bg-emerald-500 dark:bg-emerald-400",
  Steady: "bg-blue-500 dark:bg-blue-400",
  Strained: "bg-amber-500 dark:bg-amber-400",
  Struggling: "bg-rose-500 dark:bg-rose-400",
};

function moodForScore(score: number): keyof typeof HEALTH_BAR_COLOR {
  if (score >= 75) return "Thriving";
  if (score >= 50) return "Steady";
  if (score >= 25) return "Strained";
  return "Struggling";
}

function factoryLevelForScore(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 66) return 4;
  if (score >= 52) return 3;
  if (score >= 40) return 2;
  return 1;
}

const SKY_CLOUDS: Array<{
  src: string;
  top: string;
  width: string;
  startFraction: number;
  duration: number;
  direction: "normal" | "reverse";
  flip?: boolean;
}> = [
  { src: "cloud1.png", top: "3%", width: "12%", startFraction: 0 / 11, duration: 34, direction: "normal" },
  { src: "cloud4.png", top: "8%", width: "15%", startFraction: 1 / 11, duration: 38, direction: "reverse", flip: true },
  { src: "cloud7.png", top: "13%", width: "13%", startFraction: 2 / 11, duration: 31, direction: "normal" },
  { src: "cloud2.png", top: "18%", width: "14%", startFraction: 3 / 11, duration: 40, direction: "reverse" },
  { src: "cloud5.png", top: "23%", width: "10%", startFraction: 4 / 11, duration: 30, direction: "normal", flip: true },
  { src: "cloud3.png", top: "28%", width: "11%", startFraction: 5 / 11, duration: 37, direction: "reverse" },
  { src: "cloud6.png", top: "6%", width: "12%", startFraction: 6 / 11, duration: 33, direction: "normal", flip: true },
  { src: "cloud1.png", top: "16%", width: "9%", startFraction: 7 / 11, duration: 42, direction: "reverse", flip: true },
  { src: "cloud5.png", top: "26%", width: "13%", startFraction: 8 / 11, duration: 35, direction: "normal" },
  { src: "cloud4.png", top: "11%", width: "10%", startFraction: 9 / 11, duration: 29, direction: "reverse" },
  { src: "cloud2.png", top: "21%", width: "12%", startFraction: 10 / 11, duration: 39, direction: "normal", flip: true },
];

function cloudDelaySeconds(startFraction: number, duration: number, direction: "normal" | "reverse") {
  const elapsed = direction === "reverse" ? (1 - startFraction) * duration : startFraction * duration;
  return -elapsed;
}

interface DeliveryTruckConfig {
  id: string;
  src: string;
  name: string;
  direction: "rtl" | "ltr"; // rtl = default image (faces left), ltr = scale-x-[-1]
  lane: "upper" | "lower";  // upper = top half of road, lower = bottom half
  duration: number;         // seconds across screen
  delay: number;            // animation delay in seconds
  widthClass: string;
}

// Available truck models (truck1.png - truck7.png) with customized responsive widths
const TRUCK_POOL = [
  { id: "truck1", src: "truck1.png", name: "Hauler 1", widthClass: "w-20 sm:w-28 md:w-32" },
  { id: "truck2", src: "truck2.png", name: "Hauler 2", widthClass: "w-22 sm:w-30 md:w-36" },
  { id: "truck3", src: "truck3.png", name: "Hauler 3", widthClass: "w-20 sm:w-28 md:w-32" },
  { id: "truck4", src: "truck4.png", name: "Hauler 4", widthClass: "w-18 sm:w-24 md:w-28" },
  { id: "truck5", src: "truck5.png", name: "Hauler 5", widthClass: "w-22 sm:w-30 md:w-36" },
  { id: "truck6", src: "truck6.png", name: "Hauler 6", widthClass: "w-20 sm:w-28 md:w-32" },
  { id: "truck7", src: "truck7.png", name: "Hauler 7", widthClass: "w-22 sm:w-30 md:w-36" },
];

interface LaneSlot {
  slotId: string;
  lane: "upper" | "lower";
  direction: "rtl" | "ltr";
  duration: number;
  delay: number;
}

// Fixed motion slots per factory level (speed equalized per lane so no overtaking).
// The truck image rendered in each slot cycles randomly each pass!
const LEVEL_LANE_SLOTS: Record<1 | 2 | 3 | 4 | 5, LaneSlot[]> = {
  1: [
    { slotId: "s1-1", lane: "lower", direction: "ltr", duration: 5.4, delay: 0 },
  ],
  2: [
    { slotId: "s2-1", lane: "upper", direction: "rtl", duration: 5.2, delay: 0 },
    { slotId: "s2-2", lane: "lower", direction: "ltr", duration: 5.2, delay: -2.6 },
  ],
  3: [
    { slotId: "s3-1", lane: "upper", direction: "rtl", duration: 4.8, delay: 0 },
    { slotId: "s3-2", lane: "lower", direction: "ltr", duration: 4.8, delay: -1.2 },
    { slotId: "s3-3", lane: "lower", direction: "ltr", duration: 4.8, delay: -3.6 },
  ],
  4: [
    { slotId: "s4-1", lane: "upper", direction: "rtl", duration: 4.4, delay: 0 },
    { slotId: "s4-2", lane: "upper", direction: "rtl", duration: 4.4, delay: -2.2 },
    { slotId: "s4-3", lane: "lower", direction: "ltr", duration: 4.4, delay: -1.1 },
    { slotId: "s4-4", lane: "lower", direction: "ltr", duration: 4.4, delay: -3.3 },
  ],
  5: [
    { slotId: "s5-1", lane: "upper", direction: "rtl", duration: 4.0, delay: 0 },
    { slotId: "s5-2", lane: "upper", direction: "rtl", duration: 4.0, delay: -1.33 },
    { slotId: "s5-3", lane: "upper", direction: "rtl", duration: 4.0, delay: -2.66 },
    { slotId: "s5-4", lane: "lower", direction: "ltr", duration: 4.0, delay: -0.66 },
    { slotId: "s5-5", lane: "lower", direction: "ltr", duration: 4.0, delay: -2.66 },
  ],
};

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300",
  medium: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300",
  low: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [horizon, setHorizon] = useState<13 | 26>(13);
  const [explainingId, setExplainingId] = useState<string | null>(null);

  // Snapshot calculation state
  const [hasCalculation, setHasCalculation] = useState<boolean | null>(null);
  const [calcResult, setCalcResult] = useState<PipelineOutput | null>(null);
  const [activeDocCount, setActiveDocCount] = useState<number>(0);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  // Dynamic truck models per slot: randomly pick any truck 1-7
  const [slotTruckMap, setSlotTruckMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (let lvl = 1; lvl <= 5; lvl++) {
      LEVEL_LANE_SLOTS[lvl as 1 | 2 | 3 | 4 | 5].forEach((slot, idx) => {
        initial[slot.slotId] = (idx * 2 + 1) % TRUCK_POOL.length;
      });
    }
    return initial;
  });

  const handleTruckCycle = (slotId: string) => {
    setSlotTruckMap((prev) => {
      const currentIdx = prev[slotId] ?? 0;
      // Pick a random truck index different from current one
      let nextIdx = Math.floor(Math.random() * TRUCK_POOL.length);
      if (nextIdx === currentIdx) {
        nextIdx = (nextIdx + 1) % TRUCK_POOL.length;
      }
      return { ...prev, [slotId]: nextIdx };
    });
  };

  // Visualization Dev/Debug overrides
  const [devDebugOpen, setDevDebugOpen] = useState(false);
  const [devStormOverride, setDevStormOverride] = useState<boolean | null>(null);
  const [devGreenOverride, setDevGreenOverride] = useState<boolean | null>(null);
  const [devRunwayOverride, setDevRunwayOverride] = useState<number | null>(null);
  const [devLevelOverride, setDevLevelOverride] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTestingMasking, setIsTestingMasking] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadCalculation = async () => {
    try {
      const res = await fetch("/api/documents/calculate");
      const data = await res.json();
      if (data.success) {
        setHasCalculation(data.hasCalculation);
        setCalcResult(data.result);
        setActiveDocCount(data.activeCount || 0);
      }
    } catch (err) {
      console.error("Failed to load calculation snapshot:", err);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/business-profile", {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (!data?.profile) {
          router.replace("/onboarding");
          return;
        }
      } catch (err) {
        console.error("Business profile check failed:", err);
      }
      setUser(session.user);
      setIsChecking(false);
      loadCalculation();
    })();

    // Listen for live calculation updates
    const handleCalcEvent = (e: any) => {
      if (e.detail?.result) {
        setHasCalculation(true);
        setCalcResult(e.detail.result);
        setActiveDocCount(e.detail.activeCount || 0);
      }
    };
    window.addEventListener("bizmate_calculated", handleCalcEvent);
    return () => window.removeEventListener("bizmate_calculated", handleCalcEvent);
  }, [router]);

  const handleDevProcessing = async () => {
    setIsProcessing(true);
    try {
      const context = await buildAiContext();
      const json = JSON.stringify(context, stripFunctions, 2);
      const res = await fetch("/api/dev/ai-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setToastMessage(`Processed. Saved ${(result.bytes / 1024).toFixed(1)} KB to ${result.path}.`);
    } catch (err) {
      console.error("Dev processing failed:", err);
      setToastMessage("Processing failed. Check the console.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestMasking = async () => {
    setIsTestingMasking(true);
    try {
      const res = await fetch("/api/dev/ai-masking-test", { method: "POST" });
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || "Request failed");
      setToastMessage(`Masking round-trip OK (${result.model}, temp ${result.temperature}). See console for detail.`);
    } catch (err) {
      console.error("Masking test failed:", err);
      setToastMessage(`Masking test failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setIsTestingMasking(false);
    }
  };

  // Cash forecast weeks from calculation or empty (must be declared before any conditional return)
  const weeks = useMemo(() => {
    if (!calcResult?.forecasts?.base) return [];
    const baseList = calcResult.forecasts.base;
    const bearList = calcResult.forecasts.bear;
    return baseList.slice(0, horizon).map((b, idx) => ({
      week: b.week,
      label: b.weekLabel,
      base: b.closingCash,
      stress: bearList[idx]?.closingCash || b.closingCash,
    }));
  }, [calcResult, horizon]);

  if (isChecking) {
    return null;
  }

  // Derive dynamic metrics from calculation snapshot (with dev overrides if active)
  const currentHealthScore = calcResult ? calcResult.health.totalScore : 0;
  const currentFactoryLevel = devLevelOverride ?? (calcResult ? calcResult.health.factoryLevel : 1);
  const currentMood = calcResult ? calcResult.health.mood : "Struggling";
  const runwayWeeks = devRunwayOverride ?? (calcResult ? calcResult.health.runwayWeeks : 12);
  const isPriceStorm = devStormOverride !== null ? devStormOverride : Boolean(calcResult?.health?.alerts?.priceStorm);
  const isGreenEligible = devGreenOverride !== null ? devGreenOverride : Boolean(calcResult?.health?.alerts?.greenEligible);

  const maxCash = weeks.length > 0 ? Math.max(...weeks.map((w) => Math.max(w.base, w.stress)), VITALS.cushion) * 1.05 : VITALS.cushion * 1.5;

  const currentIssues = calcResult ? calcResult.rankedIssues : [];
  const highAlerts = currentIssues.filter((i) => i.severity === "high").length;

  const PAD_X = 12;
  const yFor = (value: number) => CHART_HEIGHT - (value / Math.max(1, maxCash)) * CHART_HEIGHT;
  const xFor = (idx: number) =>
    PAD_X + (idx * (LOGICAL_WIDTH - PAD_X * 2)) / Math.max(1, weeks.length - 1);
  const basePoints = weeks.map((w, idx) => ({ x: xFor(idx), y: yFor(w.base), week: w }));
  const stressPoints = weeks.map((w, idx) => ({ x: xFor(idx), y: yFor(w.stress), week: w }));
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const baseAreaPath =
    basePoints.length > 0
      ? `${toPath(basePoints)} L${basePoints[basePoints.length - 1].x},${CHART_HEIGHT} L${basePoints[0].x},${CHART_HEIGHT} Z`
      : "";
  const cushionY = yFor(VITALS.cushion);

  const greeting = getGreeting(new Date().getHours());
  const displayName = user?.businessName || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="animate-fade-in-up flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3.5">
            <Image
              src="/images/bot10_wave.png"
              alt="Welcome Bot"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md select-none pointer-events-none shrink-0"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {greeting}, {displayName}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{COMPANY.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => router.push("/dashboard/data")}
              className="text-sm font-bold px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>📂 Ingest & Calculate Data</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard/new-order")}
              className="text-sm font-bold px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-1.5"
            >
              <span>+ New order</span>
            </button>
          </div>
        </div>

        {/* Empty State Banner if no data selected or not calculated */}
        {(!hasCalculation || activeDocCount === 0) && (
          <div className="animate-fade-in-up p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Image
                src="/images/bot07_confused.png"
                alt="No Data"
                width={72}
                height={72}
                className="w-16 h-16 object-contain shrink-0 drop-shadow-md"
              />
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  No Documents Selected for Financial Calculations
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  To view live Cash Radar, Health Score, and Financing Gap, please add and toggle documents on the Data Ingest page, then click "Save & Run Calculation".
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/data")}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer shrink-0"
            >
              Add / Select Data →
            </button>
          </div>
        )}

        {/* Alerts strip */}
        <div className="animate-fade-in-up flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <span>⚠️</span>
          <span>
            {highAlerts} high alert{highAlerts === 1 ? "" : "s"} · {currentIssues.length} issues to review
          </span>
          <span className="ml-auto text-xs font-mono text-amber-600/80 dark:text-amber-400/70">
            {calcResult ? `Calculated from ${activeDocCount} active documents` : "No data calculated"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5 items-start animate-fade-in-up delay-100">
          {/* Factory visual */}
          <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 flex flex-col items-center text-center relative overflow-hidden">
            {/* Dev Debug Toggle Button */}
            <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>🏭 Growing Factory Visualization</span>
              </span>
              <button
                type="button"
                onClick={() => setDevDebugOpen((prev) => !prev)}
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  devDebugOpen || devStormOverride !== null || devGreenOverride !== null || devRunwayOverride !== null || devLevelOverride !== null
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
                title="Open Visual State Debugging Panel"
              >
                <span>🛠️ Dev Debug</span>
                <span className="text-[10px]">{devDebugOpen ? "▲" : "▼"}</span>
              </button>
            </div>

            {/* Dev Debug Interactive Control Bar */}
            {devDebugOpen && (
              <div className="w-full mb-3 p-3 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-fade-in text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold font-mono text-[11px] text-purple-900 dark:text-purple-300">
                    TEST VISUALS:
                  </span>
                  
                  {/* Storm Toggle */}
                  <button
                    type="button"
                    onClick={() => setDevStormOverride((prev) => (prev === true ? false : prev === false ? null : true))}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer border text-xs transition-colors flex items-center gap-1 ${
                      devStormOverride === true
                        ? "bg-slate-900 text-amber-400 border-amber-500 shadow-xs"
                        : devStormOverride === false
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>⚡ Storm:</span>
                    <span className="font-mono font-bold">
                      {devStormOverride === true ? "ON" : devStormOverride === false ? "OFF" : "AUTO"}
                    </span>
                  </button>

                  {/* Green Smoke Toggle */}
                  <button
                    type="button"
                    onClick={() => setDevGreenOverride((prev) => (prev === true ? false : prev === false ? null : true))}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer border text-xs transition-colors flex items-center gap-1 ${
                      devGreenOverride === true
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                        : devGreenOverride === false
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>🌱 Green Smoke:</span>
                    <span className="font-mono font-bold">
                      {devGreenOverride === true ? "ON" : devGreenOverride === false ? "OFF" : "AUTO"}
                    </span>
                  </button>

                  {/* Runway Coins Selector */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 text-[11px] font-semibold">🪙 Coins:</span>
                    {[
                      { label: "1w", val: 1 },
                      { label: "5w", val: 5 },
                      { label: "14w", val: 14 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => setDevRunwayOverride((prev) => (prev === btn.val ? null : btn.val))}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer ${
                          devRunwayOverride === btn.val
                            ? "bg-amber-500 text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Factory Level Selector */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 text-[11px] font-semibold">🏭 Lv:</span>
                    {([1, 2, 3, 4, 5] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDevLevelOverride((prev) => (prev === lvl ? null : lvl))}
                        className={`w-5 h-5 rounded text-[11px] font-mono font-bold cursor-pointer flex items-center justify-center ${
                          currentFactoryLevel === lvl
                            ? "bg-purple-600 text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset button */}
                <button
                  type="button"
                  onClick={() => {
                    setDevStormOverride(null);
                    setDevGreenOverride(null);
                    setDevRunwayOverride(null);
                    setDevLevelOverride(null);
                    setToastMessage("Visuals restored to backend calculation.");
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold cursor-pointer ml-auto"
                >
                  Reset Auto
                </button>
              </div>
            )}

            {calcResult && (
              <div
                className="absolute top-12 right-3.5 w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center z-10"
                title="Active calculation"
              >
                <LeafIcon className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Factory visualization: the illustrated scene */}
            <div className={`w-full aspect-[2.2/1] min-h-[280px] rounded-2xl ${
              isPriceStorm
                ? "bg-gradient-to-b from-slate-800 via-slate-700 to-slate-900"
                : "bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 dark:from-sky-900 dark:via-sky-950 dark:to-slate-900"
            } flex flex-col items-center justify-start pt-7 gap-1.5 mb-3 relative overflow-hidden transition-colors duration-700`}>
              <div
                className="absolute inset-0 bg-slate-500 pointer-events-none transition-opacity"
                style={{ opacity: Math.max(0, (100 - currentHealthScore) / 100) * 0.65 }}
              />

              {/* Price Risk Storm Cloud & Lightning Flash */}
              {isPriceStorm && (
                <div className="absolute inset-0 z-[2] pointer-events-none">
                  <div className="absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-slate-900/90 via-slate-850/70 to-transparent" />
                  <div className="absolute inset-0 bg-blue-100/30 mix-blend-overlay animate-lightning" />
                  <div className="absolute top-3 right-3 sm:right-16 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 border border-amber-500/60 shadow-lg backdrop-blur-xs">
                    <span className="text-xs animate-bounce">⚡</span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                      Price Risk Storm (&gt;3% Material Rise)
                    </span>
                  </div>
                </div>
              )}

              {SKY_CLOUDS.map((cloud, i) => (
                <div
                  key={i}
                  className="absolute animate-cloud-drift pointer-events-none"
                  style={{
                    top: cloud.top,
                    width: cloud.width,
                    animationDelay: `${cloudDelaySeconds(cloud.startFraction, cloud.duration, cloud.direction)}s`,
                    animationDuration: `${cloud.duration}s`,
                    animationDirection: cloud.direction,
                    filter: isPriceStorm ? "brightness(0.4) contrast(1.2)" : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/visualization/${cloud.src}`}
                    alt=""
                    className={`w-full h-auto ${cloud.flip ? "scale-x-[-1]" : ""}`}
                  />
                </div>
              ))}

              <div
                className="absolute inset-x-0 bottom-[39.5%] h-[20%] opacity-90 dark:opacity-80"
                style={{
                  backgroundImage: "url(/images/visualization/mountain.png)",
                  backgroundRepeat: "repeat-x",
                  backgroundPosition: "bottom",
                  backgroundSize: "auto 100%",
                  filter: isPriceStorm ? "brightness(0.5)" : undefined,
                }}
              />

              {/* Factory Building & Chimney Green Smoke */}
              <div className="absolute inset-x-0 bottom-[22%] h-[44%] flex items-end justify-center z-[1] -translate-x-[10%]">
                <div className="relative h-full flex items-end justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/visualization/level${currentFactoryLevel}_factory.png`}
                    alt="Factory"
                    className="h-full w-auto object-contain drop-shadow-xl transition-opacity"
                  />

                  {/* Green Mint Smoke for Green-Eligible Candidate */}
                  {isGreenEligible && (
                    <div className="absolute -top-8 right-[32%] pointer-events-none flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-400/70 blur-[3px] animate-green-smoke-1" />
                      <div className="w-7 h-7 rounded-full bg-teal-300/60 blur-[4px] animate-green-smoke-2 -mt-2.5" />
                    </div>
                  )}
                </div>
              </div>

              {/* Green-Eligible Badge */}
              {isGreenEligible && (
                <div className="absolute top-14 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/60 text-emerald-300 shadow-md backdrop-blur-xs">
                  <span className="text-[11px]">🌱</span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wide">
                    Green-Eligible (EV/Clean &ge; 30%)
                  </span>
                </div>
              )}

              {/* Factory Courtyard & Road */}
              <div className="absolute inset-x-0 bottom-0 h-[40%]">
                <div className="absolute inset-x-0 top-0 h-[58%] bg-gradient-to-b from-emerald-400 to-emerald-500 dark:from-emerald-800 dark:to-emerald-900" />
                
                {/* Coins Stacks / Weeks of Runway on the Courtyard Lawn */}
                <div
                  className="absolute top-1 sm:top-2 right-4 sm:right-8 md:right-12 flex items-end justify-center gap-1 sm:gap-1.5 z-10"
                  title={`Liquidity Runway: ${runwayWeeks} weeks of cash before 0`}
                >
                  {Array.from({ length: Math.min(8, Math.max(1, Math.round(runwayWeeks / 1.75))) }).map((_, stackIdx) => {
                    const stackHeight = Math.min(6, Math.max(1, Math.round((runwayWeeks - stackIdx) / 1.5)));
                    return (
                      <div key={stackIdx} className="flex flex-col-reverse items-center">
                        {Array.from({ length: stackHeight }).map((_, coinIdx) => (
                          <div
                            key={coinIdx}
                            className="w-3.5 h-1 sm:w-4 sm:h-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 border border-yellow-200/90 shadow-xs -mt-0.5"
                          />
                        ))}
                      </div>
                    );
                  })}
                  {runwayWeeks <= 2 && (
                    <span className="text-[9px] font-bold text-rose-300 animate-pulse ml-1 drop-shadow-md">
                      ⚠️ Low Runway (&lt;2w)
                    </span>
                  )}
                </div>

                {/* Roadway with Animated Delivery Trucks */}
                <div className="absolute inset-x-0 bottom-0 h-[42%] bg-slate-600 dark:bg-slate-700 shadow-inner">
                  {/* Road Center Divider Dashed Line */}
                  <div
                    className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 opacity-80 pointer-events-none z-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, #fde68a 0 20px, transparent 20px 40px)",
                    }}
                  />

                  {/* Delivery Trucks active for this Factory Level (Randomized models on each cycle) */}
                  {LEVEL_LANE_SLOTS[currentFactoryLevel].map((slot) => {
                    const isUpper = slot.lane === "upper";
                    const isLTR = slot.direction === "ltr";
                    const truckIdx = slotTruckMap[slot.slotId] ?? 0;
                    const truckModel = TRUCK_POOL[truckIdx % TRUCK_POOL.length];

                    return (
                      <div
                        key={slot.slotId}
                        onAnimationIteration={() => handleTruckCycle(slot.slotId)}
                        className={`absolute pointer-events-none transition-opacity duration-500 ${
                          isLTR ? "z-20 animate-truck-ltr" : "z-10 animate-truck-rtl"
                        } ${truckModel.widthClass}`}
                        style={{
                          top: isUpper ? "-55px" : "calc(50% - 45px)",
                          animationDuration: `${slot.duration}s`,
                          animationDelay: `${slot.delay}s`,
                        }}
                      >
                        <Image
                          src={`/images/visualization/${truckModel.src}`}
                          alt={truckModel.name}
                          width={140}
                          height={70}
                          className="w-full h-auto object-contain drop-shadow-md select-none"
                          priority
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Health score overlay */}
              <div className="absolute top-3 left-3 min-w-[140px] bg-white/90 dark:bg-slate-900/85 backdrop-blur-sm rounded-xl p-2.5 shadow-sm text-left">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wide">
                    Health score
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsScoreModalOpen(true)}
                    className="text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    title="View 5-part score breakdown"
                  >
                    How it works
                  </button>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                  {currentHealthScore}
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500"> /100</span>
                </p>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${HEALTH_BAR_COLOR[moodForScore(currentHealthScore)]}`}
                    style={{ width: `${currentHealthScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {currentMood}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsScoreModalOpen(true)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    View parts →
                  </button>
                </div>
              </div>
            </div>

            {/* Vitals */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <VitalTile
                icon={<CoinIcon className="w-4 h-4" />}
                color="#D97706"
                label="Cash now"
                value={calcResult?.forecasts?.base?.[0] ? formatMoney(calcResult.forecasts.base[0].closingCash) : "—"}
              />
              <VitalTile
                icon={<ShieldIcon className="w-4 h-4" />}
                color="#2563EB"
                label="Safety cushion"
                value={formatMoney(VITALS.cushion)}
                divider
              />
              <VitalTile
                icon={<PulseIcon className="w-4 h-4" />}
                color="#059669"
                label="Health score"
                value={`${currentHealthScore} / 100`}
                divider
              />
              <VitalTile
                icon={<BankIcon className="w-4 h-4" />}
                color="#6366F1"
                label="Financing need"
                value={
                  calcResult
                    ? `${formatMoney(calcResult.financing.needLow)} to ${formatMoney(calcResult.financing.needHigh)}`
                    : "—"
                }
                compact
                divider
              />
            </div>
          </div>

          {/* Lead brief */}
          <div className="space-y-3.5">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-lg">{SUPPLIER_AGENTS.lead.emoji}</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Lead's brief</h2>
                <span className="text-xs font-mono uppercase text-slate-400 ml-auto">
                  By urgency
                </span>
              </div>

              <div className="space-y-2">
                {currentIssues.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No active issues computed yet. Add documents and run calculation to populate.
                  </div>
                ) : (
                  currentIssues.map((issue) => {
                    const agent = SUPPLIER_AGENTS[issue.agent] || SUPPLIER_AGENTS.lead;
                    return (
                      <div
                        key={issue.id}
                        className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className={`text-[11px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${SEVERITY_STYLE[issue.severity]}`}
                          >
                            {issue.severity}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${agent.color}18`, color: agent.color }}
                          >
                            <span>{agent.emoji}</span>
                            <span>{agent.name}</span>
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {issue.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {issue.detail}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                issue.id.includes("financing") || issue.id.includes("cushion")
                                  ? "/dashboard/financing"
                                  : issue.id.includes("overdue")
                                  ? "/dashboard/receivables"
                                  : "/dashboard/agent-room"
                              )
                            }
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Fix this →
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cash chart */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Cash forecast (Radar)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Computed from your verified documents. Base case vs. stress case. Dashed line is your safety cushion.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHorizon(13)}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  horizon === 13
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                13 weeks
              </button>
            </div>
          </div>

          {weeks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No cash trajectory available. Ingest documents and run calculation to project weekly cash flow.
            </div>
          ) : (
            <div className="flex gap-3">
              <div
                className="flex flex-col justify-between shrink-0 w-14 sm:w-16 text-right"
                style={{ height: CHART_HEIGHT }}
              >
                {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                  <span key={f} className="text-[11px] font-mono text-slate-400 dark:text-slate-500 leading-none">
                    {formatCompactMoney(maxCash * f)}
                  </span>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <svg
                  width="100%"
                  height={CHART_HEIGHT}
                  viewBox={`0 0 ${LOGICAL_WIDTH} ${CHART_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <line
                      key={f}
                      x1={0}
                      x2={LOGICAL_WIDTH}
                      y1={CHART_HEIGHT - f * CHART_HEIGHT}
                      y2={CHART_HEIGHT - f * CHART_HEIGHT}
                      className="stroke-slate-100 dark:stroke-slate-800"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  <line
                    x1={0}
                    x2={LOGICAL_WIDTH}
                    y1={cushionY}
                    y2={cushionY}
                    className="stroke-rose-400 dark:stroke-rose-500"
                    strokeWidth={2}
                    strokeDasharray="10 6"
                    vectorEffect="non-scaling-stroke"
                  />

                  <defs>
                    <linearGradient id="baseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {baseAreaPath && <path d={baseAreaPath} fill="url(#baseAreaGradient)" />}

                  <path
                    d={toPath(stressPoints)}
                    fill="none"
                    className="stroke-amber-400 dark:stroke-amber-500"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={toPath(basePoints)}
                    fill="none"
                    className="stroke-blue-500 dark:stroke-blue-400"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />

                  {stressPoints.map((p) => (
                    <circle
                      key={`stress-${p.week.week}`}
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      vectorEffect="non-scaling-stroke"
                      className={
                        p.week.stress < VITALS.cushion
                          ? "fill-rose-500 dark:fill-rose-400"
                          : "fill-amber-400 dark:fill-amber-500"
                      }
                    >
                      <title>{`${p.week.label} stress: ${formatMoney(p.week.stress)}`}</title>
                    </circle>
                  ))}
                  {basePoints.map((p) => (
                    <circle
                      key={`base-${p.week.week}`}
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      vectorEffect="non-scaling-stroke"
                      className="fill-blue-500 dark:fill-blue-400"
                    >
                      <title>{`${p.week.label} base: ${formatMoney(p.week.base)}`}</title>
                    </circle>
                  ))}
                </svg>

                <div className="relative mt-1.5" style={{ height: 18 }}>
                  {weeks.map((w, idx) => {
                    const showLabel = horizon === 13 ? true : idx % 2 === 0;
                    if (!showLabel) return null;
                    return (
                      <span
                        key={w.week}
                        className="absolute text-[11px] font-mono text-slate-400 dark:text-slate-500 -translate-x-1/2"
                        style={{ left: `${(xFor(idx) / LOGICAL_WIDTH) * 100}%` }}
                      >
                        {w.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full bg-blue-500 dark:bg-blue-400" /> Base case
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full bg-amber-400 dark:bg-amber-500" /> Stress case
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-400" /> Stress below cushion
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-rose-400 dark:border-rose-500" /> Safety cushion
            </span>
          </div>
        </div>
      </div>

      {/* Health Score 5-Part Popup Drawer (Right side) */}
      {isScoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 dark:bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsScoreModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto space-y-5 animate-slide-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Health score {currentHealthScore}/100
                  </h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    currentMood === "Thriving"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                      : currentMood === "Steady"
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                      : currentMood === "Strained"
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                  }`}>
                    {currentMood}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Five parts, each from your own data. The factory level follows this score.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScoreModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Overall progress bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span className="text-slate-700 dark:text-slate-300">Composite Health</span>
                <span className="font-mono text-slate-900 dark:text-white">{currentHealthScore} / 100</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${HEALTH_BAR_COLOR[moodForScore(currentHealthScore)]}`}
                  style={{ width: `${currentHealthScore}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Factory Level {currentFactoryLevel} of 5 · {calcResult?.health.runwayWeeks ?? 12} weeks of liquidity runway
              </p>
            </div>

            {/* The 5 Parts */}
            <div className="space-y-4">
              {/* Part 1: Cash cushion */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Cash cushion
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {calcResult ? calcResult.health.cashCushionScore : "15.2"} / 30
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((calcResult?.health.cashCushionScore ?? 15.2) / 30) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calcResult?.health.details?.cushionDetail ??
                    `Lowest cash in 13 weeks vs your ${COMPANY.currency}${(VITALS.cushion / 1000).toFixed(0)}k cushion`}
                </p>
              </div>

              {/* Part 2: Buyer payments */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Buyer payments
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {calcResult ? calcResult.health.buyerPaymentsScore : "12.4"} / 25
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((calcResult?.health.buyerPaymentsScore ?? 12.4) / 25) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calcResult?.health.details?.buyerPaymentsDetail ?? "22% of what buyers owe is overdue"}
                </p>
              </div>

              {/* Part 3: Margin and input costs */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Margin and input costs
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {calcResult ? calcResult.health.marginCostsScore : "14.4"} / 20
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((calcResult?.health.marginCostsScore ?? 14.4) / 20) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calcResult?.health.details?.marginCostsDetail ??
                    "Net cash margin 7.0%; materials could rise 5% in 3 months"}
                </p>
              </div>

              {/* Part 4: Buyer concentration */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Buyer concentration
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {calcResult ? calcResult.health.concentrationScore : "7.5"} / 10
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((calcResult?.health.concentrationScore ?? 7.5) / 10) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calcResult?.health.details?.concentrationDetail ?? "Top buyer is 38% of sales"}
                </p>
              </div>

              {/* Part 5: Debt load */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Debt load
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {calcResult ? calcResult.health.debtLoadScore : "14.2"} / 15
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((calcResult?.health.debtLoadScore ?? 14.2) / 15) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calcResult?.health.details?.debtLoadDetail ??
                    `Interest ${COMPANY.currency}6k a month`}
                </p>
              </div>
            </div>

            {/* Footer action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsScoreModalOpen(false);
                  router.push("/dashboard/data");
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer text-center block shadow-xs"
              >
                Ingest More Documents to Improve Score →
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}

function VitalTile({
  icon,
  color,
  label,
  value,
  compact,
  divider,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  compact?: boolean;
  divider?: boolean;
}) {
  return (
    <div className={divider ? "sm:border-l sm:border-slate-100 dark:sm:border-slate-800 sm:pl-4" : ""}>
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">{label}</p>
      <p
        className={`font-bold text-slate-900 dark:text-white mt-1 ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
