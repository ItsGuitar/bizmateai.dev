"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";
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

// TEMP DEV TOOL: mirrors the score->mood bands from HEALTH's level comment (>=75 Thriving).
function moodForScore(score: number): keyof typeof HEALTH_BAR_COLOR {
  if (score >= 75) return "Thriving";
  if (score >= 50) return "Steady";
  if (score >= 25) return "Strained";
  return "Struggling";
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
  // TEMP DEV TOOL: lets us eyeball the health score bar/mood at any value. Remove before ship.
  const [devScore, setDevScore] = useState(HEALTH.score);

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
    })();
  }, [router]);

  if (isChecking) {
    return null;
  }

  const weeks = CASH_WEEKS.slice(0, horizon);
  const maxCash = Math.max(...weeks.map((w) => Math.max(w.base, w.stress)), VITALS.cushion) * 1.05;
  const highAlerts = RANKED_ISSUES.filter((i) => i.severity === "high").length;

  // Line chart geometry: fixed logical units, scaled to 100% of the card width via the SVG's
  // viewBox (preserveAspectRatio="none"), so it always fills the card instead of scrolling.
  const PAD_X = 12;
  const yFor = (value: number) => CHART_HEIGHT - (value / maxCash) * CHART_HEIGHT;
  const xFor = (idx: number) =>
    PAD_X + (idx * (LOGICAL_WIDTH - PAD_X * 2)) / Math.max(1, weeks.length - 1);
  const basePoints = weeks.map((w, idx) => ({ x: xFor(idx), y: yFor(w.base), week: w }));
  const stressPoints = weeks.map((w, idx) => ({ x: xFor(idx), y: yFor(w.stress), week: w }));
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const baseAreaPath = `${toPath(basePoints)} L${basePoints[basePoints.length - 1].x},${CHART_HEIGHT} L${basePoints[0].x},${CHART_HEIGHT} Z`;
  const cushionY = yFor(VITALS.cushion);

  const greeting = getGreeting(new Date().getHours());
  const displayName = user?.businessName || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="animate-fade-in-up">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {greeting}, {displayName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{COMPANY.name}</p>
        </div>

        {/* Alerts strip */}
        <div className="animate-fade-in-up flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <span>⚠️</span>
          <span>
            {highAlerts} high alert{highAlerts === 1 ? "" : "s"} · {RANKED_ISSUES.length} issues to review
          </span>
          <span className="ml-auto text-xs font-mono text-amber-600/80 dark:text-amber-400/70">
            As of {COMPANY.asOf}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5 items-start animate-fade-in-up delay-100">
          {/* Factory visual */}
          <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 flex flex-col items-center text-center relative overflow-hidden">
            {FACTORY.greenEligible && (
              <div
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center z-10"
                title="Green eligible"
              >
                <LeafIcon className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Placeholder frame: the illustrated factory visualization will render here */}
            <div className="w-full aspect-[2.2/1] min-h-[280px] rounded-2xl border-2 border-dashed border-sky-400 dark:border-sky-700 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 dark:from-sky-900 dark:via-sky-950 dark:to-slate-900 flex flex-col items-center justify-start pt-7 gap-1.5 mb-3 relative overflow-hidden">
              {/* Sky mood: the lower the health score, the duller/greyer the sky reads. Sits
                  behind the mountains/ground (earlier in DOM) so only the exposed sky is tinted. */}
              <div
                className="absolute inset-0 bg-slate-500 pointer-events-none transition-opacity"
                style={{ opacity: Math.max(0, (100 - devScore) / 100) * 0.65 }}
              />

              {/* Mountains: source art is pre-trimmed to its opaque bounding box (no transparent
                  margin), so it tiles edge-to-edge with repeat-x instead of leaving sky gaps
                  between clusters, and sits flush on the bottom edge with no size workaround. */}
              <div
                className="absolute inset-x-0 bottom-[39.5%] h-[20%] opacity-90 dark:opacity-80"
                style={{
                  backgroundImage: "url(/images/visualization/mountain.png)",
                  backgroundRepeat: "repeat-x",
                  backgroundPosition: "bottom",
                  backgroundSize: "auto 100%",
                }}
              />

              {/* Ground: grass + road so the factory icon reads as sitting in a scene, not floating in sky */}
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

              {/* Health score overlay: lives on the visualization itself */}
              <div className="absolute top-3 left-3 w-32 bg-white/90 dark:bg-slate-900/85 backdrop-blur-sm rounded-xl p-2.5 shadow-sm text-left">
                <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wide">
                  Health score
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                  {devScore}
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500"> /100</span>
                </p>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${HEALTH_BAR_COLOR[moodForScore(devScore)]}`}
                    style={{ width: `${devScore}%` }}
                  />
                </div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {moodForScore(devScore)}
                </p>
              </div>

            </div>

            {/* Vitals: live directly under the visualization, not crammed into a side column */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <VitalTile
                icon={<CoinIcon className="w-4 h-4" />}
                color="#D97706"
                label="Cash now"
                value={formatMoney(VITALS.cashNow)}
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
                value={`${devScore} / 100`}
                divider
              />
              <VitalTile
                icon={<BankIcon className="w-4 h-4" />}
                color="#6366F1"
                label="Financing need"
                value={`${formatMoney(VITALS.financingNeedLow)} to ${formatMoney(VITALS.financingNeedHigh)}`}
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
                {RANKED_ISSUES.map((issue) => {
                  const agent = SUPPLIER_AGENTS[issue.agent];
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

                      {explainingId === issue.id && (
                        <p className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {issue.explain}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/agent-room")}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Fix this →
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExplainingId((prev) => (prev === issue.id ? null : issue.id))
                          }
                          className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {explainingId === issue.id ? "Hide explanation" : "Explain with AI"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Cash chart */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Cash forecast</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Base case vs. stress case. Dashed line is your safety cushion.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {([13, 26] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    horizon === h
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {h}w
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {/* Y-axis labels */}
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

            {/* Plot area: fills 100% of the remaining card width */}
            <div className="flex-1 min-w-0">
              <svg
                width="100%"
                height={CHART_HEIGHT}
                viewBox={`0 0 ${LOGICAL_WIDTH} ${CHART_HEIGHT}`}
                preserveAspectRatio="none"
              >
                {/* Gridlines */}
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

                {/* Cushion line */}
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

                {/* Base case area fill */}
                <defs>
                  <linearGradient id="baseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={baseAreaPath} fill="url(#baseAreaGradient)" />

                {/* Stress line */}
                <path
                  d={toPath(stressPoints)}
                  fill="none"
                  className="stroke-amber-400 dark:stroke-amber-500"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Base line */}
                <path
                  d={toPath(basePoints)}
                  fill="none"
                  className="stroke-blue-500 dark:stroke-blue-400"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Markers */}
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

              {/* X-axis labels */}
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
              <span className="w-4 border-t-2 border-dashed border-rose-400 dark:border-rose-500" /> Safety
              cushion
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up delay-300">
          {/* Biggest moves */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">Biggest moves</h2>
            <div className="space-y-2">
              {BIGGEST_MOVES.map((move) => (
                <div key={move.id} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <span
                    className={
                      move.direction === "up"
                        ? "text-emerald-500"
                        : move.direction === "down"
                        ? "text-rose-500"
                        : "text-slate-400"
                    }
                  >
                    {move.direction === "up" ? "▲" : move.direction === "down" ? "▼" : "→"}
                  </span>
                  <span>{move.text}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-center">
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  {PAST_12_MONTHS.ordersFulfilled}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Orders, 12mo</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  {formatMoney(PAST_12_MONTHS.revenueInvoiced)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Revenue invoiced</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  {PAST_12_MONTHS.avgBuyerGrade}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Avg. buyer grade</p>
              </div>
            </div>
          </div>

          {/* Agent room card */}
          <button
            type="button"
            onClick={() => router.push("/dashboard/agent-room")}
            className="text-left bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 dark:from-blue-700 dark:via-indigo-800 dark:to-slate-900 border border-blue-700/40 rounded-3xl shadow-xs p-5 text-white relative overflow-hidden cursor-pointer hover:shadow-lg transition-all group"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:bg-white/15 transition-colors" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧭</span>
              <h2 className="text-base font-bold">Agent room</h2>
              <span className="ml-auto text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/15">
                Live
              </span>
            </div>
            <p className="text-sm text-blue-50/90 leading-relaxed mb-3">
              Watch the Lead, Receivables, Procurement and Financing agents work through the
              Guangzhou Motors order plan. Every step, every number, nothing hidden.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              <span>Open the room</span>
              <span>→</span>
            </span>
          </button>
        </div>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-4 right-4 z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-3">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wide mb-1">
            Dev: health score
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={devScore}
            onChange={(e) => setDevScore(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
            {devScore} / 100 · {moodForScore(devScore)}
          </p>
        </div>
      )}
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
