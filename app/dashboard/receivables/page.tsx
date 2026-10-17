"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { AgentRoomView } from "@/app/components/AgentRoomView";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { COMPANY, OPEN_INVOICES, COLLECT_RUN, type Invoice } from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import {
  BUYERS,
  AS_OF,
  Z_P10,
  daysBetween,
  formatDate,
  getBuyerModel,
  gradeScore,
  gradeLetter,
  expectedOpenInvoicePayment,
  chaseStepForOverdue,
  eIouDiscountedAmount,
  CHASE_STEPS,
  type InvoiceRisk,
  type BuyerModel,
} from "@/lib/order-engine";
import type { PipelineOutput } from "@/lib/calculation-pipeline";

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${COMPANY.currency}${Math.abs(Math.round(n)).toLocaleString()}`;
}

const RISK_STYLE: Record<InvoiceRisk, string> = {
  none: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  late: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  high: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
};

const RISK_LABEL: Record<InvoiceRisk, string> = {
  none: "Not due",
  late: "Late",
  high: "High risk",
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-600 dark:text-emerald-400",
  B: "text-blue-600 dark:text-blue-400",
  C: "text-amber-600 dark:text-amber-400",
  D: "text-rose-600 dark:text-rose-400",
  New: "text-slate-500 dark:text-slate-400",
};

const LANGUAGES = ["English", "Thai", "Simplified Chinese"];
const CHANNELS = ["Email", "LINE", "WeChat", "App"];

export default function ReceivablesPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic Snapshot & Active Documents
  const [calcResult, setCalcResult] = useState<PipelineOutput | null>(null);
  const [activeInvoices, setActiveInvoices] = useState<Invoice[]>([]);
  const [hasCalculation, setHasCalculation] = useState<boolean | null>(null);

  const [remindInvoice, setRemindInvoice] = useState<Invoice | null>(null);
  const [remindLanguage, setRemindLanguage] = useState(LANGUAGES[0]);
  const [remindChannel, setRemindChannel] = useState(CHANNELS[0]);
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set());
  const [discountedInvoices, setDiscountedInvoices] = useState<Set<string>>(new Set());

  const [showChaseRun, setShowChaseRun] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [isThinking, setIsThinking] = useState(true);
  const [chaseApprovals, setChaseApprovals] = useState<Record<string, "approved" | "declined">>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Reword & Approval Card States
  const [reminderText, setReminderText] = useState("");
  const [isRewording, setIsRewording] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const loadData = async () => {
    try {
      // 1. Fetch calculation snapshot
      const calcRes = await fetch("/api/documents/calculate");
      const calcData = await calcRes.json();
      if (calcData.success && calcData.hasCalculation) {
        setHasCalculation(true);
        setCalcResult(calcData.result);
      } else {
        setHasCalculation(false);
      }

      // 2. Fetch documents from CDM
      const docRes = await fetch("/api/documents");
      const docData = await docRes.json();
      if (docData.documents) {
        const invoiceDocs = docData.documents
          .filter((d: any) => d.isEnabled && d.docType.toLowerCase().includes("invoice"))
          .map((d: any) => ({
            id: d.id,
            no: d.docNumber,
            buyerName: d.counterparty,
            amount: d.amount,
            issueDate: d.issueDate,
            dueDate: d.dueDate || d.issueDate,
            method: "bank" as const,
            product: "Industrial goods",
          }));
        setActiveInvoices(invoiceDocs);
      }
    } catch (err) {
      console.error("Receivables load error:", err);
    }
  };

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
        setHasCalculation(true);
        setCalcResult(e.detail.result);
        loadData();
      }
    };
    window.addEventListener("bizmate_calculated", handleCalcEvent);
    return () => window.removeEventListener("bizmate_calculated", handleCalcEvent);
  }, [router]);

  // Use active documents from CDM, fallback to default mock invoices so user can test immediately
  const displayedInvoices = activeInvoices.length > 0 ? activeInvoices : OPEN_INVOICES;

  // Active buyers from calculation result
  const dynamicBuyers: BuyerModel[] = useMemo(() => {
    if (calcResult?.buyerModels && calcResult.buyerModels.length > 0) {
      return calcResult.buyerModels.map((bm) => ({
        name: bm.buyerName,
        mu: bm.mu,
        sigma: bm.sigma,
        grade: bm.grade,
        n: 3,
      }));
    }
    return BUYERS;
  }, [calcResult]);

  const invoiceRows = useMemo(
    () =>
      displayedInvoices.map((inv) => {
        const buyer = dynamicBuyers.find((b) => b.name === inv.buyerName) || getBuyerModel(inv.buyerName, dynamicBuyers);
        const dueDate = new Date(`${inv.dueDate}T00:00:00Z`);
        const payment = expectedOpenInvoicePayment(dueDate, buyer, AS_OF);
        const chase = chaseStepForOverdue(payment.overdueDays);
        return { invoice: inv, buyer, dueDate, payment, chase };
      }),
    [displayedInvoices, dynamicBuyers]
  );

  const totalOutstanding = invoiceRows.reduce((sum, r) => sum + r.invoice.amount, 0);
  const overdueNow = invoiceRows.filter((r) => r.payment.overdueDays > 0).reduce((sum, r) => sum + r.invoice.amount, 0);
  const dueWithin14 = invoiceRows
    .filter((r) => r.payment.overdueDays === 0 && daysBetween(AS_OF, r.dueDate) <= 14)
    .reduce((sum, r) => sum + r.invoice.amount, 0);
  const highRiskCount = invoiceRows.filter((r) => r.payment.risk === "high").length;

  const buyerBreakdowns = useMemo(
    () =>
      dynamicBuyers.map((buyer) => {
        const hasOverdue = invoiceRows.some((r) => r.buyer.name === buyer.name && r.payment.overdueDays > 0);
        const scoreClean = gradeScore(buyer.mu, buyer.sigma, false);
        const scoreNow = gradeScore(buyer.mu, buyer.sigma, hasOverdue);
        const letterClean = gradeLetter(scoreClean, buyer.n);
        const letterNow = gradeLetter(scoreNow, buyer.n);
        const openForBuyer = invoiceRows.filter((r) => r.buyer.name === buyer.name);
        return { buyer, hasOverdue, scoreClean, scoreNow, letterClean, letterNow, openForBuyer };
      }),
    [invoiceRows, dynamicBuyers]
  );

  const totalChaseEvents = COLLECT_RUN.events.length;
  const chaseDone = revealCount >= totalChaseEvents;

  useEffect(() => {
    if (!showChaseRun || chaseDone) {
      setIsThinking(false);
      return;
    }
    setIsThinking(true);
    timerRef.current = setTimeout(() => {
      setRevealCount((prev) => Math.min(prev + 1, totalChaseEvents));
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showChaseRun, revealCount, chaseDone, totalChaseEvents]);

  if (isChecking) {
    return null;
  }

  const receivables = SUPPLIER_AGENTS.receivables;

  const handleOpenRemind = (invoice: Invoice) => {
    setRemindInvoice(invoice);
    setRemindLanguage(LANGUAGES[0]);
    setRemindChannel(CHANNELS[0]);
    // Pre-populate with default polite text
    const buyer = dynamicBuyers.find((b) => b.name === invoice.buyerName) || getBuyerModel(invoice.buyerName, dynamicBuyers);
    const dueDate = new Date(`${invoice.dueDate}T00:00:00Z`);
    const payment = expectedOpenInvoicePayment(dueDate, buyer, AS_OF);
    setReminderText(
      `Dear ${invoice.buyerName} team,\n\nWe would like to gently follow up on invoice ${invoice.no} for ${formatMoney(invoice.amount)}, which was due on ${invoice.dueDate} (${payment.overdueDays} days ago).\n\nPlease let us know if there is anything needed from our side to assist with the payment schedule.\n\nBest regards,\nAccounting Department`
    );
  };

  const handleRewordWithAi = async () => {
    if (!remindInvoice) return;
    setIsRewording(true);
    try {
      const buyer = dynamicBuyers.find((b) => b.name === remindInvoice.buyerName) || getBuyerModel(remindInvoice.buyerName, dynamicBuyers);
      const dueDate = new Date(`${remindInvoice.dueDate}T00:00:00Z`);
      const payment = expectedOpenInvoicePayment(dueDate, buyer, AS_OF);

      const res = await fetch("/api/ai/reword-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: remindInvoice.buyerName,
          invoiceNumber: remindInvoice.no,
          amount: remindInvoice.amount,
          currency: COMPANY.currency,
          dueDate: remindInvoice.dueDate,
          overdueDays: payment.overdueDays,
          language: remindLanguage,
          channel: remindChannel,
        }),
      });

      const data = await res.json();
      if (data.draftText) {
        setReminderText(data.draftText);
        setToastMessage(`Reworded for ${remindChannel} in ${remindLanguage} with Multimodal AI.`);
      } else {
        throw new Error(data.error || "Failed to generate reminder");
      }
    } catch (err: any) {
      console.error("AI Reword error:", err);
      setToastMessage(`AI Reword error: ${err.message}`);
    } finally {
      setIsRewording(false);
    }
  };

  const handleSubmitApprovalCard = async () => {
    if (!remindInvoice || !reminderText.trim()) return;
    setIsSubmittingApproval(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "receivables",
          title: `Send payment reminder to ${remindInvoice.buyerName}`,
          description: `Channel: ${remindChannel} (${remindLanguage})\n\nMessage:\n"${reminderText.trim()}"`,
          impact: `+${formatMoney(remindInvoice.amount)} expected cash collection upon receipt`,
          requiresFaceId: false,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSentReminders((prev) => new Set(prev).add(remindInvoice.id));
        setToastMessage(`Approval card created in Central Inbox! Nothing is sent until you approve.`);
        setRemindInvoice(null);
      } else {
        throw new Error(data.error || "Failed to create approval card");
      }
    } catch (err: any) {
      console.error("Approval card submission error:", err);
      setToastMessage(`Submission error: ${err.message}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleDiscountEIou = (row: (typeof invoiceRows)[number]) => {
    const maturityDays = Math.max(0, daysBetween(AS_OF, row.dueDate) - 2);
    const discounted = eIouDiscountedAmount(row.invoice.amount, maturityDays);
    setDiscountedInvoices((prev) => new Set(prev).add(row.invoice.id));
    setToastMessage(
      `${row.invoice.buyerName}'s e-IOU discounted today: ${formatMoney(discounted)} now instead of ${formatMoney(row.invoice.amount)} on ${formatDate(row.dueDate)}.`
    );
  };

  const handleStartChaseRun = () => {
    setShowChaseRun(true);
    setRevealCount(0);
    setIsThinking(true);
    setChaseApprovals({});
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Receivables & Buyer Grades
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                When each buyer really pays, who's overdue, and credibility-weighted payment models.
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

        {/* Empty state alert if no active invoices */}
        {(!hasCalculation || displayedInvoices.length === 0) && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <span className="text-base">⚠️</span>
              <span>No active Invoices selected in Canonical Data Model. Please add or enable invoices in Data Ingest.</span>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/data")}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              Go to Data Ingest →
            </button>
          </div>
        )}

        {/* Agent bar */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${receivables.color}18`, color: receivables.color }}
            >
              {receivables.emoji}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{receivables.name}</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Deterministic Model
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Learns how each buyer really pays using shrinkage shrinkage (k=3) and drafts polite reminders.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={displayedInvoices.length === 0}
            onClick={handleStartChaseRun}
            className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
          >
            Chase all with steps →
          </button>
        </div>

        {/* KPIs */}
        <div className="animate-fade-in-up delay-150 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total outstanding", value: formatMoney(totalOutstanding), color: "#F97316" },
            { label: "Overdue now", value: formatMoney(overdueNow), color: "#EF4444" },
            { label: "Due within 14 days", value: formatMoney(dueWithin14), color: "#EAB308" },
            { label: "High-risk invoices", value: String(highRiskCount), color: "#6366F1" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
              <p className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wide">{kpi.label}</p>
              <p className="text-base font-black mt-1" style={{ color: kpi.color }}>
                {displayedInvoices.length === 0 ? "—" : kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* When each buyer really pays */}
        <div className="animate-fade-in-up delay-200 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">When each buyer really pays</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            Days late, counting from the due date. Evaluated with confidence windows (p10 to p90).
          </p>

          {(() => {
            const maxDays = 70;
            const ticks = [0, 14, 28, 42, 56, 70];
            const rowGridClass = "grid items-center gap-3" as const;
            const rowGridStyle = { gridTemplateColumns: "10rem 1fr 3.5rem" };
            return (
              <div className="mt-3">
                {dynamicBuyers.map((buyer) => {
                  const p10 = Math.max(0, buyer.mu - Z_P10 * buyer.sigma);
                  const p90 = Math.min(maxDays, buyer.mu + Z_P10 * buyer.sigma);
                  const muPct = Math.min(100, (buyer.mu / maxDays) * 100);
                  const p10Pct = Math.min(100, (p10 / maxDays) * 100);
                  const widthPct = Math.max(0, Math.min(100 - p10Pct, ((p90 - p10) / maxDays) * 100));
                  return (
                    <div key={buyer.name} className={`${rowGridClass} mb-3`} style={rowGridStyle}>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {buyer.name}
                      </span>
                      <div className="relative h-3 rounded bg-slate-50 dark:bg-slate-800/60">
                        {ticks.map((t) => (
                          <div
                            key={t}
                            className="absolute top-0 bottom-0 w-px bg-slate-200/70 dark:bg-slate-700/50"
                            style={{ left: `${(t / maxDays) * 100}%` }}
                          />
                        ))}
                        <div
                          className="absolute inset-y-0 rounded bg-orange-300/70 dark:bg-orange-500/40"
                          style={{ left: `${p10Pct}%`, width: `${widthPct}%` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-5 rounded-full bg-orange-600 dark:bg-orange-400"
                          style={{ left: `${muPct}%` }}
                        />
                      </div>
                      <span className="text-right text-xs font-mono text-slate-400">~{buyer.mu}d</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Buyer scorecards */}
        <div className="animate-fade-in-up delay-300 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">Buyer Scorecard & Cutoff Grades</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-slate-500 dark:text-slate-400 pb-3 pr-4 align-bottom">
                    Buyer Name
                  </th>
                  {buyerBreakdowns.map(({ buyer, letterNow }) => (
                    <th key={buyer.name} className="text-left pb-3 px-3 align-bottom min-w-[8.5rem]">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{buyer.name}</div>
                      <div className={`text-xl font-black ${GRADE_COLOR[letterNow]}`}>{letterNow}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <tr>
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300 font-medium">Mean Delay (μ)</td>
                  {buyerBreakdowns.map(({ buyer }) => (
                    <td key={buyer.name} className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                      {buyer.mu} days
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300 font-medium">Std Deviation (σ)</td>
                  {buyerBreakdowns.map(({ buyer }) => (
                    <td key={buyer.name} className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                      ±{buyer.sigma} days
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300 font-medium">Overdue Status</td>
                  {buyerBreakdowns.map(({ buyer, hasOverdue }) => (
                    <td key={buyer.name} className="py-2.5 px-3">
                      {hasOverdue ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">Overdue (-8)</span>
                      ) : (
                        <span className="text-slate-400">Current</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-3 pr-4 font-bold text-slate-900 dark:text-white">Score → Grade</td>
                  {buyerBreakdowns.map(({ buyer, scoreNow, letterNow }) => (
                    <td key={buyer.name} className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {scoreNow.toFixed(0)} pts → <span className={GRADE_COLOR[letterNow]}>{letterNow}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Open invoices */}
        <div className="animate-fade-in-up delay-350 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Open Invoices</h3>
            <span className="text-xs font-mono text-slate-400">{invoiceRows.length} Documents from CDM</span>
          </div>
          <div className="space-y-2">
            {invoiceRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No open invoices on file. Scan or toggle invoices in Data Ingest to show them here.
              </div>
            ) : (
              invoiceRows.map((row) => {
                const alreadySent = sentReminders.has(row.invoice.id);
                const alreadyDiscounted = discountedInvoices.has(row.invoice.id);
                return (
                  <div
                    key={row.invoice.id}
                    className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${RISK_STYLE[row.payment.risk]}`}>
                          {RISK_LABEL[row.payment.risk]}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{row.invoice.no}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{row.invoice.buyerName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatMoney(row.invoice.amount)} · due {formatDate(row.dueDate)}
                        {row.payment.overdueDays > 0 && ` · ${row.payment.overdueDays} days overdue`}
                        {" · expected payment "}
                        {formatDate(row.payment.expected)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenRemind(row.invoice)}
                        disabled={alreadySent}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-40 shadow-xs flex items-center gap-1"
                      >
                        {alreadySent ? "Sent for approval" : "🔔 Remind with AI"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Remind drawer with Multimodal/Text AI Rewording & Approval Card Creation */}
      {remindInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          onClick={() => setRemindInvoice(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Payment Reminder Draft
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {remindInvoice.buyerName} · {remindInvoice.no}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemindInvoice(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Financial Facts Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice:</span>
                <span className="font-bold text-slate-900 dark:text-white">{remindInvoice.no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{formatMoney(remindInvoice.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due Date:</span>
                <span className="text-slate-700 dark:text-slate-300">{remindInvoice.dueDate}</span>
              </div>
            </div>

            {/* Channel and Language Selectors */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Language</label>
                <select
                  value={remindLanguage}
                  onChange={(e) => setRemindLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer text-slate-900 dark:text-white"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Channel</label>
                <select
                  value={remindChannel}
                  onChange={(e) => setRemindChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer text-slate-900 dark:text-white"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* AI Reword Action Bar */}
            <div className="pt-1">
              <button
                type="button"
                disabled={isRewording}
                onClick={handleRewordWithAi}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRewording ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Rewording with AI (Masked Privacy)...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Reword with AI ({remindLanguage} · {remindChannel})</span>
                  </>
                )}
              </button>
            </div>

            {/* Editable Draft Text Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Message Content Preview
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Editable</span>
              </div>
              <textarea
                rows={6}
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                placeholder="Click 'Reword with AI' above or type your polite reminder here..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Confirmation & Approval Card Hand-off */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                disabled={!reminderText.trim() || isSubmittingApproval}
                onClick={handleSubmitApprovalCard}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {isSubmittingApproval ? (
                  <span>Saving to Approval Center...</span>
                ) : (
                  <>
                    <span>🛡️</span>
                    <span>Send to Approval Center (Zero-Surprise)</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-400 leading-tight">
                Nothing is sent directly to the buyer. A formal approval card will be created for owner authorization.
              </p>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
