"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { COMPANY } from "@/app/data/supplier-copilot-mock";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import { AgentIcon } from "@/app/components/icons/AgentIcons";
import { DocumentScanModal } from "@/app/components/DocumentScanModal";
import type { InvoiceOcrFields } from "@/app/api/ai/ocr-invoice/route";
import type { PipelineOutput } from "@/lib/calculation-pipeline";

interface IngestedDocRecord {
  id: string;
  fileName: string;
  docType: string;
  counterparty: string;
  docNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate?: string | null;
  termsDays?: number;
  isEnabled: boolean;
  verifiedStatus: string;
  auditHash?: string;
}

export default function DataIngestPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [docs, setDocs] = useState<IngestedDocRecord[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  // Edit Modal State
  const [editingDoc, setEditingDoc] = useState<IngestedDocRecord | null>(null);

  // Calculation State
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<PipelineOutput | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
    fetchDocuments();
  }, [router]);

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.documents) {
        setDocs(data.documents);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  if (isChecking) {
    return null;
  }

  const lead = SUPPLIER_AGENTS.lead;

  // Save scanned document to Backend
  const handleScanConfirm = async (fields: InvoiceOcrFields) => {
    let typeValue = "invoice";
    if (fields.documentType === "purchase_order") typeValue = "purchase_order";
    else if (fields.documentType === "receipt") typeValue = "receipt";
    else if (fields.documentType === "other") typeValue = "other";

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: `${fields.documentNumber || "DOC"}_scanned.png`,
          docType: typeValue,
          counterparty: fields.counterpartyName || "Unspecified Counterparty",
          docNumber: fields.documentNumber || `REF-${Math.floor(Math.random() * 9000 + 1000)}`,
          amount: fields.totalAmount || 0,
          currency: fields.currency || COMPANY.currency,
          issueDate: fields.issueDate || new Date().toISOString().split("T")[0],
          dueDate: fields.dueDate || null,
          termsDays: fields.termsDays || 30,
          itemsJson: JSON.stringify(fields.items || []),
        }),
      });

      const data = await res.json();
      if (data.document) {
        setDocs((prev) => [data.document, ...prev]);
        setToastMessage(`Saved ${data.document.docNumber} to backend Canonical Data Model.`);
      } else {
        throw new Error(data.error || "Failed to persist");
      }
    } catch (err: any) {
      console.error("Save document error:", err);
      setToastMessage(`Error saving document: ${err.message}`);
    }
  };

  // Toggle isEnabled for calculation
  const handleToggleInclude = async (id: string, current: boolean) => {
    const updatedStatus = !current;
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isEnabled: updatedStatus } : d))
    );

    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: updatedStatus }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Delete document from backend
  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this document from the database?")) return;

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
        setToastMessage("Document removed from backend.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Save edited document
  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    try {
      const res = await fetch(`/api/documents/${editingDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterparty: editingDoc.counterparty,
          docNumber: editingDoc.docNumber,
          amount: editingDoc.amount,
          issueDate: editingDoc.issueDate,
          dueDate: editingDoc.dueDate,
          docType: editingDoc.docType,
        }),
      });
      const data = await res.json();
      if (data.document) {
        setDocs((prev) => prev.map((d) => (d.id === editingDoc.id ? data.document : d)));
        setEditingDoc(null);
        setToastMessage("Document changes saved to backend.");
      }
    } catch (err) {
      console.error("Failed to edit doc:", err);
    }
  };

  // Run 7-Stage Deterministic Calculation Chain
  const handleRunCalculation = async () => {
    setIsCalculating(true);
    setToastMessage("Executing 7-stage deterministic AI calculation chain...");
    try {
      const res = await fetch("/api/documents/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asOf: "2026-10-17",
          openingCash: 1260000,
          safetyCushion: 980000,
        }),
      });

      const data = await res.json();
      if (data.result) {
        setCalcResult(data.result);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("bizmate_calculated", {
              detail: { result: data.result, activeCount },
            })
          );
        }
        setToastMessage("7-Stage calculation chain complete! Updated all metrics across dashboard.");
      } else {
        throw new Error(data.error || "Calculation failed");
      }
    } catch (err: any) {
      console.error("Calculation failed:", err);
      setToastMessage(`Calculation error: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const activeCount = docs.filter((d) => d.isEnabled).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-16">
      <AppHeader user={user} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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
                Data & Document Ingestion
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Store, verify, and run deterministic 7-stage calculation chains on paperwork.
              </p>
            </div>
          </div>
        </div>

        {/* Lead Agent Ingest Bar */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap relative overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 z-10">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${lead.color}18`, color: lead.color }}
            >
              <AgentIcon id={lead.iconId} className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{lead.name} (Ingest & CDM)</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Data Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Toggled documents feed into the deterministic calculation engine: cash flow, buyer grades, and financing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 z-10">
            <Image
              src="/images/bot08_tablet.png"
              alt=""
              width={64}
              height={64}
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain select-none pointer-events-none drop-shadow-md shrink-0 hidden sm:block"
            />
            <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
              {activeCount} of {docs.length} Active in Calculations
            </span>
          </div>
        </div>

        {/* Action Banner: Run Calculation */}
        {docs.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-blue-600 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>⚡ Deterministic Calculation Chain</span>
                <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-mono">7 STAGES</span>
              </div>
              <p className="text-xs text-blue-100 mt-1 max-w-xl">
                Click to recompute Entity Resolution, Buyer Payment Shrinkage, 13-Week Cash Radar, Factory Health Score, and Financing Gap.
              </p>
            </div>
            <button
              type="button"
              disabled={isCalculating || activeCount === 0}
              onClick={handleRunCalculation}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-2 ${
                isCalculating || activeCount === 0
                  ? "bg-white/40 text-white/70 cursor-not-allowed"
                  : "bg-white text-blue-800 hover:bg-blue-50 active:scale-95"
              }`}
            >
              {isCalculating ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span>Calculating Chain...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>Save & Run Calculation ({activeCount})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Live Calculation Results Widget */}
        {calcResult && (
          <div className="animate-fade-in-up bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Latest 7-Stage Calculation Run Results
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Timestamp: {new Date(calcResult.calculatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500">Health Score</div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {calcResult.health.totalScore} / 100
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                  Level {calcResult.health.factoryLevel} ({calcResult.health.mood})
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500">Financing Need Gap</div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  ¥{(calcResult.financing.needLow / 1000).toFixed(0)}k - ¥{(calcResult.financing.needHigh / 1000).toFixed(0)}k
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Term: {calcResult.financing.termMonths} Months
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500">Comfortable Rate Ceiling</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {calcResult.financing.rateCeilingPct}% max
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Comfort: {calcResult.financing.comfortableRatePct}%
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500">Runway Forecast</div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {calcResult.health.runwayWeeks} Weeks
                </div>
                <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                  {calcResult.rankedIssues.length} Prioritized Issues
                </div>
              </div>
            </div>

            {/* Ingestion Verification Table */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                <span>Stage 1: Ingestion Verification & Matching</span>
                <span className="text-[10px] text-slate-400 font-normal">Entity Match ≥ 0.86 Similarity</span>
              </div>
              <div className="space-y-1.5">
                {calcResult.verification.map((v) => (
                  <div
                    key={v.docId}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{v.docNumber}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {v.matchedBuyerOrSupplier || v.normalizedCounterparty}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        sim: {v.similarity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.isVerifiedReceivable ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          ✓ Verified Receivable
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">Unmatched Stmt</span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400" title={`SHA-256: ${v.auditHash}`}>
                        Hash: {v.auditHash.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scan Entry Point Card */}
        {/* Scan & Ingest Entry Point Card */}
        <div
          onClick={() => setIsScanModalOpen(true)}
          className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shrink-0">
              📁
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Upload or Scan Document (Excel / PDF / Image)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Drop spreadsheets, digital PDFs, or scanned photos. Excel and text PDFs are parsed directly without OCR; photos support privacy redaction before Vision OCR.
              </p>
            </div>
          </div>
          <span className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-xs transition-colors">
            Upload & Ingest →
          </span>
        </div>

        {/* Ingested Documents Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Verified Documents on File (CDM Backend)
              </h2>
              <p className="text-[11px] text-slate-400">
                Check or uncheck items to toggle inclusion in the deterministic calculation engine.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {isLoadingDocs ? "Syncing..." : `${docs.length} Stored Documents`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase">
                <tr>
                  <th className="py-3 px-3 text-center w-10">Include</th>
                  <th className="py-3 px-4">Document / File</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4">Counterparty</th>
                  <th className="py-3 px-3">Issue Date</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Image
                          src="/images/bot02_sit.png"
                          alt="Empty Documents"
                          width={64}
                          height={64}
                          className="w-14 h-14 object-contain select-none pointer-events-none opacity-80"
                        />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          No documents on record yet
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          Use the button above to scan an Invoice or PO. Confirmed items will be stored in PostgreSQL CDM.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  docs.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`transition-colors ${
                        doc.isEnabled
                          ? "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                          : "opacity-50 bg-slate-50/20 dark:bg-slate-900/30"
                      }`}
                    >
                      {/* Checkbox for inclusion */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={doc.isEnabled}
                          onChange={() => handleToggleInclude(doc.id, doc.isEnabled)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Include in financial calculations"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{doc.docNumber}</span>
                          {doc.auditHash && (
                            <span
                              className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400"
                              title={`Tamper-proof audit hash: ${doc.auditHash}`}
                            >
                              #hash
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">
                          {doc.fileName}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium capitalize">
                          {doc.docType.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {doc.counterparty}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {doc.issueDate}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {doc.dueDate || "—"}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {doc.currency}{doc.amount.toLocaleString()}
                      </td>

                      {/* Action buttons: Edit and Delete */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingDoc(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Edit Document"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Delete Document"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Ingested Document
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Document Number
                </label>
                <input
                  type="text"
                  value={editingDoc.docNumber}
                  onChange={(e) => setEditingDoc({ ...editingDoc, docNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Counterparty Name
                </label>
                <input
                  type="text"
                  value={editingDoc.counterparty}
                  onChange={(e) => setEditingDoc({ ...editingDoc, counterparty: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Amount ({editingDoc.currency})
                  </label>
                  <input
                    type="number"
                    value={editingDoc.amount}
                    onChange={(e) => setEditingDoc({ ...editingDoc, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Document Type
                  </label>
                  <select
                    value={editingDoc.docType}
                    onChange={(e) => setEditingDoc({ ...editingDoc, docType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="invoice">Invoice</option>
                    <option value="purchase_order">Purchase Order</option>
                    <option value="receipt">Receipt</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={editingDoc.issueDate}
                    onChange={(e) => setEditingDoc({ ...editingDoc, issueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editingDoc.dueDate || ""}
                    onChange={(e) => setEditingDoc({ ...editingDoc, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <DocumentScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onConfirm={handleScanConfirm}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
