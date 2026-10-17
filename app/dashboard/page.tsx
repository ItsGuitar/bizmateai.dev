"use client";

import React, { useEffect, useState, useMemo } from "react";
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

  // Derive dynamic metrics from calculation snapshot
  const currentHealthScore = calcResult ? calcResult.health.totalScore : 0;
  const currentFactoryLevel = calcResult ? calcResult.health.factoryLevel : 1;
  const currentMood = calcResult ? calcResult.health.mood : "Struggling";

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
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {greeting}, {displayName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{COMPANY.name}</p>
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
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
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
            {calcResult && (
              <div
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center z-10"
                title="Active calculation"
              >
                <LeafIcon className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Factory visualization: the illustrated scene */}
            <div className="w-full aspect-[2.2/1] min-h-[280px] rounded-2xl bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 dark:from-sky-900 dark:via-sky-950 dark:to-slate-900 flex flex-col items-center justify-start pt-7 gap-1.5 mb-3 relative overflow-hidden">
              <div
                className="absolute inset-0 bg-slate-500 pointer-events-none transition-opacity"
                style={{ opacity: Math.max(0, (100 - currentHealthScore) / 100) * 0.65 }}
              />

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
                }}
              />

              <div className="absolute inset-x-0 bottom-[20%] h-[30%] flex items-end justify-center z-[1] -translate-x-[12%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/visualization/level${currentFactoryLevel}_factory.png`}
                  alt="Factory"
                  className="h-full w-auto object-contain drop-shadow-lg transition-opacity"
                />
              </div>

              <div className="absolute inset-x-0 bottom-0 h-[40%]">
                <div className="absolute inset-x-0 top-0 h-[58%] bg-gradient-to-b from-emerald-400 to-emerald-500 dark:from-emerald-800 dark:to-emerald-900" />
                <div className="absolute inset-x-0 bottom-0 h-[42%] bg-slate-500 dark:bg-slate-700">
                  <div
                    className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 opacity-80"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, #fde68a 0 20px, transparent 20px 40px)",
                    }}
                  />
                </div>
              </div>

              {/* Health score overlay */}
              <div className="absolute top-3 left-3 w-32 bg-white/90 dark:bg-slate-900/85 backdrop-blur-sm rounded-xl p-2.5 shadow-sm text-left">
                <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wide">
                  Health score
                </p>
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
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {currentMood}
                </p>
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
