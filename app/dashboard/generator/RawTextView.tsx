"use client";

import React from "react";
import type { GeneratedDocument } from "@/lib/document-generator";
import { documentToCsvRows, csvRowsToString } from "@/lib/csv-export";
import type { LanguageCode } from "@/lib/generator-i18n";

function partyLine(party: GeneratedDocument["buyer"], activeLanguages: Set<LanguageCode>): string {
  const showLocal = party.nameLocal && party.localLang && activeLanguages.has(party.localLang);
  return `${party.name}${showLocal ? " / " + party.nameLocal : ""}`;
}

function itemLine(li: GeneratedDocument["lineItems"][number], activeLanguages: Set<LanguageCode>): string {
  const parts = [activeLanguages.has("en") ? li.descriptionEn : null, activeLanguages.has("zh") ? li.descriptionZh : null, activeLanguages.has("th") ? li.descriptionTh : null].filter(Boolean);
  return `${parts.join(" / ") || li.descriptionEn},${li.qtyDisplay},${li.unitPriceDisplay},${li.lineTotalDisplay}`;
}

function buildRawText(doc: GeneratedDocument, activeLanguages: Set<LanguageCode>): string {
  if (doc.archetype === "messy_ledger") {
    return csvRowsToString(documentToCsvRows(doc));
  }

  const lines: string[] = [];
  lines.push("*** UNVERIFIED SCAN OUTPUT, DO NOT FILE ***");
  lines.push("");
  lines.push(`doc no : ${doc.documentNumber}`);
  lines.push(`date   :${doc.issueDateDisplay}`);
  lines.push(`seller: ${partyLine(doc.seller, activeLanguages)}`);
  lines.push(`buyer :${partyLine(doc.buyer, activeLanguages)}`);
  lines.push(`terms  : ${doc.paymentTerm}`);
  lines.push("");
  lines.push("item,qty,unit price,amount");
  doc.lineItems.forEach((li) => {
    lines.push(itemLine(li, activeLanguages));
  });
  lines.push("");
  lines.push(`subtotal,,,${doc.totals.subtotalDisplay}`);
  lines.push(`tax ${doc.totals.taxRatePct}%,,,${doc.totals.taxDisplay}`);
  if (doc.totals.discountDisplay) lines.push(`discount,,,${doc.totals.discountDisplay}`);
  lines.push(`TOTAL,,,${doc.totals.grandTotalDisplay}`);
  lines.push("");
  lines.push("-- end of extracted text, synthetic data for testing --");
  return lines.join("\n");
}

export function RawTextView({ doc, activeLanguages }: { doc: GeneratedDocument; activeLanguages: Set<LanguageCode> }) {
  const text = buildRawText(doc, activeLanguages);
  return (
    <div className="p-4">
      <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words p-4 rounded-2xl bg-slate-950 text-emerald-300 overflow-x-auto">
        {text}
      </pre>
    </div>
  );
}
