"use client";

import React, { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { SearchableSelect } from "@/app/components/SearchableSelect";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { COMPANY } from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import {
  BUYERS,
  MATERIALS,
  DEFAULT_ORDER_INPUT,
  checkOrder,
  computeSensitivities,
  formatDate,
  getMaterialPrice,
  type OrderInput,
  type Scenario,
} from "@/lib/order-engine";
import { DocumentScanModal } from "@/app/components/DocumentScanModal";
import type { InvoiceOcrFields } from "@/app/api/ai/ocr-invoice/route";

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${COMPANY.currency}${Math.abs(Math.round(n)).toLocaleString()}`;
}

function formatSignedMoney(n: number): string {
  if (n === 0) return formatMoney(0);
  return `${n > 0 ? "+" : "-"}${COMPANY.currency}${Math.abs(Math.round(n)).toLocaleString()}`;
}

const VERDICT_STYLE: Record<
  string,
  { label: string; detail: string; className: string }
> = {
  renegotiate: {
    label: "Renegotiate",
    detail: "The order loses money at the expected material price. Ask for a higher price or a fixed-price material deal before taking it.",
    className: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300",
  },
  take_it: {
    label: "Take it",
    detail: "No stress-case cash gap. The order pays for itself before the supplier bill is due.",
    className: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300",
  },
  take_it_fixed_price: {
    label: "Take it, fixed price only",
    detail: "Worst-case material price wipes out the margin. Lock the material price before accepting.",
    className: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300",
  },
  take_it_with_financing: {
    label: "Take it, with financing",
    detail: "Profitable either way, but materials must be paid before the buyer pays. Cover the gap below.",
    className: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300",
  },
};

const SCENARIO_LABEL: Record<Scenario, string> = {
  bull: "Bull",
  base: "Base",
  bear: "Bear",
  custom: "Custom",
};

export default function NewOrderPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [form, setForm] = useState<OrderInput>(DEFAULT_ORDER_INPUT);
  const [hasChecked, setHasChecked] = useState(false);
  const [scenarioView, setScenarioView] = useState<Scenario | "all">("base");
  const [customDelayDays, setCustomDelayDays] = useState(30);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);

  React.useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);

    (async () => {
      try {
        const res = await fetch("/api/documents/calculate");
        const data = await res.json();
        if (data.success && data.hasCalculation) {
          setCalcResult(data.result);
        }
      } catch (err) {
        console.error("New order calc load failed:", err);
      }
    })();

    const handleCalc = (e: any) => {
      if (e.detail?.result) setCalcResult(e.detail.result);
    };
    window.addEventListener("bizmate_calculated", handleCalc);
    return () => window.removeEventListener("bizmate_calculated", handleCalc);
  }, [router]);

  const activeScenario: Scenario = scenarioView === "all" ? "base" : scenarioView;
  const result = useMemo(
    () => checkOrder(form, activeScenario, customDelayDays),
    [form, activeScenario, customDelayDays]
  );
  const bullResult = useMemo(() => checkOrder(form, "bull"), [form]);
  const baseResult = useMemo(() => checkOrder(form, "base"), [form]);
  const bearResult = useMemo(() => checkOrder(form, "bear"), [form]);
  const sensitivities = useMemo(() => computeSensitivities(form), [form]);
  const materialPrice = getMaterialPrice(form.material);

  // If calculation pipeline provided an updated ceiling, blend it
  const effectiveCeiling = calcResult?.financing?.rateCeilingPct || result.rateCeilingPct;

  if (isChecking) {
    return null;
  }

  const verdict = VERDICT_STYLE[result.verdict];
  const lead = SUPPLIER_AGENTS.lead;

  const handleScanConfirm = (fields: InvoiceOcrFields) => {
    setForm((prev) => {
      const next = { ...prev };
      if (fields.counterpartyName) {
        next.buyerName = fields.counterpartyName;
      }
      if (fields.dueDate) {
        next.deliveryDate = fields.dueDate;
      } else if (fields.issueDate) {
        next.deliveryDate = fields.issueDate;
      }
      if (fields.termsDays) {
        next.termsDays = fields.termsDays;
      }
      if (fields.items && fields.items.length > 0) {
        const first = fields.items[0];
        if (first.quantity) next.qty = first.quantity;
        if (first.unitPrice) next.pricePerUnit = first.unitPrice;
      } else if (fields.totalAmount && next.qty > 0) {
        next.pricePerUnit = Math.round((fields.totalAmount / next.qty) * 100) / 100;
      }
      return next;
    });
    setHasChecked(false);
    setToastMessage(`Extracted details for ${fields.counterpartyName || "order"} applied. Ready for analysis.`);
  };

  const handleCheckOrder = () => setHasChecked(true);

  const handleAcceptOrder = () => {
    setToastMessage("Order accepted. Handing off to the agents.");
    router.push("/dashboard/agent-room");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <div className="animate-fade-in-up">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-1 cursor-pointer inline-flex items-center gap-1"
          >
            <span>←</span>
            <span>Back to Home</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            New order
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enter a quote or PO. The agents check profit, cash gap and financing before you commit.
          </p>
        </div>

        {/* Agent bar */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap relative overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 z-10">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${lead.color}18`, color: lead.color }}
            >
              {lead.emoji}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{lead.name}</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  AI agent
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Routes every new order through Procurement, Receivables and Financing before you decide.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 z-10">
            <Image
              src="/images/bot10_wave.png"
              alt=""
              width={46}
              height={46}
              className="w-11 h-11 object-contain select-none pointer-events-none opacity-85 shrink-0 hidden sm:block drop-shadow-xs"
            />
            <button
              type="button"
              onClick={() => router.push("/dashboard/agent-room")}
              className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Run with steps →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 items-start">
          {/* Order form */}
          <div className="animate-fade-in-up delay-150 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Order details</h2>
              <button
                type="button"
                onClick={() => setIsScanModalOpen(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>📷</span>
                <span>Read a PO / Invoice photo</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Buyer</label>
              <SearchableSelect
                options={BUYERS.map((b) => b.name)}
                value={form.buyerName}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, buyerName: v }));
                  setHasChecked(false);
                }}
                placeholder="Select a buyer"
                allowClear={false}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Material</label>
              <SearchableSelect
                options={MATERIALS.map((m) => m.name)}
                value={form.material}
                onChange={(v) => {
                  const next = getMaterialPrice(v);
                  setForm((prev) => ({ ...prev, material: v, kgPerUnit: next.kgPerUnitDefault }));
                  setHasChecked(false);
                }}
                placeholder="Select a material"
                allowClear={false}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={form.qty}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, qty: Number(e.target.value) || 0 }));
                    setHasChecked(false);
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">
                  Price / unit ({COMPANY.currency})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.pricePerUnit}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, pricePerUnit: Number(e.target.value) || 0 }));
                    setHasChecked(false);
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Delivery date</label>
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, deliveryDate: e.target.value }));
                    setHasChecked(false);
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Terms (days)</label>
                <input
                  type="number"
                  min={0}
                  value={form.termsDays}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, termsDays: Number(e.target.value) || 0 }));
                    setHasChecked(false);
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              {form.qty.toLocaleString()} units × {materialPrice.kgPerUnitDefault === form.kgPerUnit ? form.kgPerUnit : form.kgPerUnit} kg/unit ≈{" "}
              {((form.qty * form.kgPerUnit) / 1000).toFixed(0)} t of {form.material.toLowerCase()}.
            </p>

            <button
              type="button"
              onClick={handleCheckOrder}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all cursor-pointer shadow-sm"
            >
              Check order
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!hasChecked ? (
              <div className="animate-fade-in-up delay-200 bg-white dark:bg-slate-900/90 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Fill in the order and press <span className="font-semibold text-slate-600 dark:text-slate-300">Check order</span> to see the verdict, cash gap and financing need.
              </div>
            ) : (
              <>
                {/* Verdict */}
                <div className={`animate-fade-in-up delay-200 rounded-3xl border p-4 ${verdict.className}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-black">{verdict.label}</span>
                    <span className="text-xs font-mono">
                      Buyer: {form.buyerName || "New buyer"} · Grade {result.buyer.grade}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed">{verdict.detail}</p>
                </div>

                {/* Journey timeline */}
                <div className="animate-fade-in-up delay-250 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Order journey</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {result.journey.map((step, idx) => (
                      <div key={step.id} className="flex flex-col items-center text-center gap-1">
                        <div className="flex items-center w-full">
                          <span
                            className={`mx-auto w-9 h-9 rounded-2xl flex items-center justify-center text-base ${
                              idx === 0 ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                            }`}
                          >
                            {step.emoji}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                          {step.label}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          {formatDate(step.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cash-gap bar */}
                <div className="animate-fade-in-up delay-300 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cash gap</h3>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      {result.cashGapDays > 0 ? `${result.cashGapDays} days` : "No gap"}
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {result.cashGapDays > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-rose-400 dark:from-amber-500 dark:to-rose-500 rounded-full"
                        style={{ width: "100%" }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>💸 Pay supplier {formatDate(result.supplierPayDate)}</span>
                    <span>🏦 Buyer pays {formatDate(result.buyerPay.expected)}</span>
                  </div>
                </div>

                {/* Profit + financing need */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="animate-fade-in-up delay-350 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
                    <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Profit</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {formatMoney(result.profitMid)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Range {formatMoney(result.profitP10)} to {formatMoney(result.profitP90)}
                    </p>
                  </div>
                  <div className="animate-fade-in-up delay-400 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
                    <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Money needed</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {formatMoney(result.financingNeedLow)}
                      <span className="text-sm font-bold text-slate-400 dark:text-slate-500"> to {formatMoney(result.financingNeedHigh)}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {result.termMonths}-month term · rate ceiling {effectiveCeiling.toFixed(1)}% · comfortable {result.comfortableRatePct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Scenario card */}
                <div className="animate-fade-in-up delay-450 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scenarios</h3>
                    <select
                      value={scenarioView}
                      onChange={(e) => setScenarioView(e.target.value as Scenario | "all")}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="all">All</option>
                      <option value="bull">Bull</option>
                      <option value="base">Base</option>
                      <option value="bear">Bear</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {scenarioView === "custom" && (
                    <div className="mb-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        <span>Buyer pays this many days late</span>
                        <span className="font-mono">{customDelayDays} days</span>
                      </div>
                      <input
                        type="range"
                        min={-5}
                        max={150}
                        value={customDelayDays}
                        onChange={(e) => setCustomDelayDays(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}

                  {scenarioView === "all" ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { key: "bull" as const, r: bullResult },
                        { key: "base" as const, r: baseResult },
                        { key: "bear" as const, r: bearResult },
                      ].map(({ key, r }) => (
                        <div key={key} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                          <p className="text-[11px] font-mono uppercase font-bold text-slate-400">{SCENARIO_LABEL[key]}</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{formatMoney(r.profitMid)}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Need to {formatMoney(r.financingNeedHigh)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-mono uppercase text-slate-400 font-bold">Profit</p>
                        <p className="text-base font-black text-slate-900 dark:text-white">{formatMoney(result.profitMid)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-mono uppercase text-slate-400 font-bold">Buyer pays</p>
                        <p className="text-base font-black text-slate-900 dark:text-white">{formatDate(result.buyerPay.expected)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sensitivities */}
                <div className="animate-fade-in-up delay-500 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Sensitivities</h3>
                  <div className="space-y-1.5">
                    {sensitivities.map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
                        <span className="font-mono font-bold flex items-center gap-2">
                          <span className={row.profitDelta < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                            profit {formatSignedMoney(row.profitDelta)}
                          </span>
                          {row.secondary && (
                            <span className="text-slate-400 dark:text-slate-500">{row.secondary}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAcceptOrder}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Accept order →
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <DocumentScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onConfirm={handleScanConfirm}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
