"use client";

import React from "react";
import type { GroundTruthFields } from "@/lib/document-generator";
import type { ExtractDocumentResponse } from "@/app/api/ai/extract-document/route";

interface ExtractionPanelProps {
  result: ExtractDocumentResponse | null;
  groundTruth: GroundTruthFields;
  isLoading: boolean;
}

const FIELD_LABELS: Array<{ key: keyof GroundTruthFields; label: string }> = [
  { key: "documentNumber", label: "Document no." },
  { key: "issueDate", label: "Date" },
  { key: "buyerName", label: "Buyer" },
  { key: "sellerName", label: "Seller" },
  { key: "grandTotal", label: "Grand total" },
  { key: "currencySymbol", label: "Currency" },
  { key: "lineItemCount", label: "Line items" },
];

function valuesMatch(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return false;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.01;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export function ExtractionPanel({ result, groundTruth, isLoading }: ExtractionPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {FIELD_LABELS.map((f) => (
          <div key={f.key} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 animate-pulse">
            <span className="text-xs text-slate-400">{f.label}</span>
            <span className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  if (!result) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Not sent yet. Click "Send to the AI agent" to see what it reads back from this document.
      </p>
    );
  }

  return (
    <div>
      {result.simulated && (
        <div className="mb-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60">
            Simulated
          </span>
          <span>Live extraction unavailable right now, showing a simulated result from this document's own data.</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] font-mono uppercase text-slate-400 font-bold">
              <th className="pb-2 pr-3">Field</th>
              <th className="pb-2 pr-3">Extracted</th>
              <th className="pb-2 pr-3">Ground truth</th>
              <th className="pb-2">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {FIELD_LABELS.map((f) => {
              const extracted = result.extractedFields[f.key];
              const truth = groundTruth[f.key];
              const match = valuesMatch(extracted, truth);
              return (
                <tr key={f.key}>
                  <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{f.label}</td>
                  <td className="py-2 pr-3 font-mono text-slate-900 dark:text-white">
                    {extracted !== undefined ? String(extracted) : <span className="text-slate-400">missing</span>}
                  </td>
                  <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">{String(truth)}</td>
                  <td className="py-2">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        match
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {match ? "✓" : "✕"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
