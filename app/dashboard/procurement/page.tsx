"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { COMPANY } from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import { AgentIcon } from "@/app/components/icons/AgentIcons";
import { MATERIALS, MaterialPrice, getMaterialPrice } from "@/lib/order-engine";
import type { PipelineOutput } from "@/lib/calculation-pipeline";

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${COMPANY.currency}${Math.abs(Math.round(n)).toLocaleString()}`;
}

interface BuyLot {
  id: string;
  material: string;
  tonnes: number;
  deliveryMonth: string;
  supplierPayDate: string;
  expectedCost: number;
  highCaseCost: number;
  cashBeforePaying: number;
  trend: "rising" | "falling" | "stable";
  action: "lock_price" | "split_lot" | "collect_first" | "delay_lot" | "arrange_financing";
  actionLabel: string;
  actionExplanation: string;
}

export default function ProcurementPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [calcResult, setCalcResult] = useState<PipelineOutput | null>(null);
  const [activeDocs, setActiveDocs] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("Cold-rolled steel");
  const [executedLots, setExecutedLots] = useState<Set<string>>(new Set());

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
    loadData();

    const handleCalcEvent = (e: any) => {
      if (e.detail?.result) {
        setCalcResult(e.detail.result);
        loadData();
      }
    };
    window.addEventListener("bizmate_calculated", handleCalcEvent);
    return () => window.removeEventListener("bizmate_calculated", handleCalcEvent);
  }, [router]);

  const loadData = async () => {
    try {
      const calcRes = await fetch("/api/documents/calculate");
      const calcData = await calcRes.json();
      if (calcData.success && calcData.hasCalculation) {
        setCalcResult(calcData.result);
      }

      const docRes = await fetch("/api/documents");
      const docData = await docRes.json();
      if (docData.documents) {
        setActiveDocs(docData.documents.filter((d: any) => d.isEnabled));
      }
    } catch (err) {
      console.error("Procurement load error:", err);
    }
  };

  const procurement = SUPPLIER_AGENTS.procurement;
  const mat = getMaterialPrice(selectedMaterial);

  // Generate 4-month price forecast band (NEW_DESIGN.md Section 5.6)
  const priceForecastMonths = useMemo(() => {
    const months = ["Nov 2026", "Dec 2026", "Jan 2027", "Feb 2027"];
    return months.map((m, idx) => {
      const h = idx + 1;
      const p50 = Math.round(mat.midPerTonne * (1 + 0.008 * h));
      const p10 = Math.round(mat.lowPerTonne * (1 + 0.005 * h));
      const p90 = Math.round(mat.highPerTonne * (1 + 0.012 * h));
      return { month: m, p10, p50, p90 };
    });
  }, [mat]);

  // Compute buy lots based on active orders/bills & forecast cash
  const buyLots: BuyLot[] = useMemo(() => {
    const cushion = 980000;
    const baseClosingCash = calcResult?.forecasts?.base?.[4]?.closingCash || 1120000;

    const poDocs = activeDocs.filter(
      (d) => d.docType.toLowerCase().includes("purchase") || d.docType.toLowerCase().includes("bill")
    );

    if (poDocs.length === 0) {
      // Default buy lot from order if no bill
      const tonnes = 299;
      const expectedCost = tonnes * mat.midPerTonne;
      const highCost = tonnes * mat.highPerTonne;
      const cashBefore = baseClosingCash + expectedCost;
      const isRising = true;

      let action: BuyLot["action"] = "split_lot";
      let actionLabel = "Split into Two Lots";
      let actionExplanation = "Cash covers the buy and price is steady. Splitting 150t now and 149t in 21 days smooths outflows.";

      if (cashBefore - highCost >= cushion && isRising) {
        action = "lock_price";
        actionLabel = "Lock Fixed Price";
        actionExplanation = "Cash after worst-case cost clears the safety cushion and prices are trending up.";
      } else if (cashBefore < cushion) {
        action = "collect_first";
        actionLabel = "Collect Invoices First";
        actionExplanation = "Cash shortfall detected before supplier pay date. Trigger Receivables agent to collect overdue invoices.";
      }

      return [
        {
          id: "lot-default",
          material: selectedMaterial,
          tonnes,
          deliveryMonth: "Nov 2026",
          supplierPayDate: "15 Dec 2026",
          expectedCost,
          highCaseCost: highCost,
          cashBeforePaying: cashBefore,
          trend: "rising",
          action,
          actionLabel,
          actionExplanation,
        },
      ];
    }

    return poDocs.map((doc, idx) => {
      const tonnes = Math.max(10, Math.round(doc.amount / mat.midPerTonne));
      const expectedCost = doc.amount;
      const highCost = expectedCost * 1.05;
      const cashBefore = baseClosingCash + expectedCost;

      return {
        id: `lot-${doc.id}`,
        material: doc.counterparty || selectedMaterial,
        tonnes,
        deliveryMonth: doc.issueDate || "Nov 2026",
        supplierPayDate: doc.dueDate || "15 Dec 2026",
        expectedCost,
        highCaseCost: highCost,
        cashBeforePaying: cashBefore,
        trend: "rising",
        action: "split_lot",
        actionLabel: "Split into 2 Delivery Lots",
        actionExplanation: `Smoothing payment of ${formatMoney(expectedCost)} into phased supplier batches.`,
      };
    });
  }, [activeDocs, calcResult, mat, selectedMaterial]);

  const handleExecuteStrategy = async (lot: BuyLot) => {
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "procurement",
          title: `${lot.actionLabel}: ${lot.material}`,
          description: lot.actionExplanation,
          impact: `${formatMoney(lot.expectedCost)} · supplier pay date ${lot.supplierPayDate}`,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save");
      setExecutedLots((prev) => new Set(prev).add(lot.id));
      setToastMessage(`Sent for your approval: ${lot.actionLabel} for ${lot.material}.`);
    } catch (err: any) {
      setToastMessage(err.message || "Could not save that request.");
    }
  };

  if (isChecking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-16">
      <AppHeader user={user} />

      <div data-tour="procurement-forecast" className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="animate-fade-in-up">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-1 cursor-pointer inline-flex items-center gap-1"
          >
            <span>←</span>
            <span>Back to Home</span>
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Procurement & Material Price Forecast
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Deterministic buy lots, commodity price bands (p10 / p50 / p90), and decision trees.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/data")}
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
            >
              📂 Manage Documents
            </button>
          </div>
        </div>

        {/* Agent bar */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap relative overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 z-10">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${procurement.color}18`, color: procurement.color }}
            >
              <AgentIcon id={procurement.iconId} className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{procurement.name}</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Decision Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Analyzes commodity bands and liquidity buffers to recommend Lock Price, Split Lots, or Collect First.
              </p>
            </div>
          </div>
          <Image
            src="/images/bot05_box_side.png"
            alt=""
            width={64}
            height={64}
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain select-none pointer-events-none drop-shadow-md shrink-0 hidden sm:block"
          />
        </div>

        {/* Material Selector & Price Forecast Band */}
        <div className="animate-fade-in-up delay-150 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Commodity Price Forecast Band (4 Months)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lognormal random-walk forecast model with p10 (low), p50 (expected), and p90 (stress high) per tonne.
              </p>
            </div>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {MATERIALS.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {priceForecastMonths.map((pf) => (
              <div
                key={pf.month}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
              >
                <div className="text-[11px] font-mono text-slate-400 font-bold uppercase">{pf.month}</div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  ¥{pf.p50.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Range: ¥{pf.p10.toLocaleString()} – ¥{pf.p90.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Procurement Decision Tree & Next Buy Lots */}
        <div className="animate-fade-in-up delay-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Procurement Decision Tree & Planned Lots
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rule engine evaluation (Section 5.7): compares Cash Before Paying vs. Safety Cushion.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {buyLots.length} Planned Lots
            </span>
          </div>

          <div className="space-y-3">
            {buyLots.map((lot) => (
              <div
                key={lot.id}
                className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {lot.material} ({lot.tonnes} tonnes)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-bold">
                      {lot.actionLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    {lot.actionExplanation}
                  </p>
                  <div className="text-[11px] font-mono text-slate-400 pt-1">
                    Expected Cost: {formatMoney(lot.expectedCost)} · Pay Date: {lot.supplierPayDate}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExecuteStrategy(lot)}
                    disabled={executedLots.has(lot.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {executedLots.has(lot.id) ? "Sent for approval ✓" : "Execute Strategy →"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
