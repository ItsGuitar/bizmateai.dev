"use client";

import React from "react";
import type { GeneratedDocument, GeneratedLineItem, GeneratedParty } from "@/lib/document-generator";
import { L, renderLabel, type LanguageCode } from "@/lib/generator-i18n";

// html2canvas 1.4.1 cannot parse the oklch()/lab() color functions Tailwind v4 compiles its
// palette to (it silently produces a blank canvas). The captured subtree below therefore uses
// plain hex colors via inline style, never Tailwind color utilities, so export/AI-send always
// captures real pixels regardless of the app's theme. This is a printed paper, it looks the same
// in light or dark mode by design.
const INK = "#0f172a";
const SUB = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#cbd5e1";
const LINE_LIGHT = "#e2e8f0";
const ROSE = "#e11d48";
const INDIGO = "#4338ca";
const BLACK = "#000000";
const WHITE = "#ffffff";
const PAPER_WIDTH: Record<GeneratedDocument["layoutVariant"], number> = { boxed: 640, letterhead: 640, compact: 380 };

const ARCHETYPE_TITLE: Record<GeneratedDocument["archetype"], ReturnType<typeof L>> = {
  po: L("Purchase Order", "采购订单", "ใบสั่งซื้อ"),
  supplier_invoice: L("Supplier Invoice", "供应商发票", "ใบแจ้งหนี้ซัพพลายเออร์"),
  receivable_invoice: L("Tax Invoice", "增值税发票", "ใบกำกับภาษี"),
  messy_ledger: L("Raw Ledger Export", "原始台账导出"),
};

const DATE_LABEL = L("Date", "日期", "วันที่");
const DUE_LABEL = L("Due", undefined, "กำหนดชำระ");
const SELLER_LABEL = L("Seller", "卖方", "ผู้ขาย");
const BUYER_LABEL = L("Buyer", "买方", "ผู้ซื้อ");
const DESCRIPTION_LABEL = L("Description", "品名", "รายการ");
const SAMPLE_LABEL = L("SAMPLE", "样本");
const DISCLAIMER = "Generated for testing only. All names, IDs and amounts are synthetic.";

function RedactedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1">
      <span className="text-[9px] uppercase tracking-wide block" style={{ color: FAINT }}>
        {label}
      </span>
      <span className="relative inline-block">
        <span className="invisible select-none text-xs">{value}</span>
        <span className="absolute inset-0 rounded-[2px]" style={{ backgroundColor: BLACK }} />
      </span>
    </div>
  );
}

function lineDescription(li: GeneratedLineItem, activeLanguages: Set<LanguageCode>): string {
  const parts: string[] = [];
  if (activeLanguages.has("zh") && li.descriptionZh) parts.push(li.descriptionZh);
  if (activeLanguages.has("th") && li.descriptionTh) parts.push(li.descriptionTh);
  return parts.join(" / ");
}

function partyLocal(party: GeneratedParty, activeLanguages: Set<LanguageCode>): string | null {
  return party.nameLocal && party.localLang && activeLanguages.has(party.localLang) ? party.nameLocal : null;
}

interface BodyProps {
  doc: GeneratedDocument;
  activeLanguages: Set<LanguageCode>;
}

// --- Variant 1: boxed, side-by-side seller/buyer info boxes, bordered table -------------------

function BoxedDocument({ doc, activeLanguages }: BodyProps) {
  return (
    <>
      <div className="flex items-start justify-between pb-3 mb-4" style={{ borderBottom: `2px solid ${INK}` }}>
        <div>
          <p className="text-base font-black">{renderLabel(ARCHETYPE_TITLE[doc.archetype], activeLanguages)}</p>
          <p className="text-[11px] mt-1" style={{ color: SUB }}>
            {doc.documentNumberLabel}: <span className="font-mono">{doc.documentNumber}</span>
          </p>
        </div>
        <div className="text-right text-[11px]" style={{ color: SUB }}>
          <p>{renderLabel(DATE_LABEL, activeLanguages)}</p>
          <p className="font-mono font-bold" style={{ color: INK }}>
            {doc.issueDateDisplay}
          </p>
          {doc.dueDateDisplay && (
            <>
              <p className="mt-1">{renderLabel(DUE_LABEL, activeLanguages)}</p>
              <p className="font-mono font-bold" style={{ color: INK }}>
                {doc.dueDateDisplay}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {[
          { role: renderLabel(SELLER_LABEL, activeLanguages), party: doc.seller },
          { role: renderLabel(BUYER_LABEL, activeLanguages), party: doc.buyer },
        ].map(({ role, party }) => (
          <div key={role} className="rounded-xl p-3 flex-1 min-w-0" style={{ border: `1px solid ${LINE}` }}>
            <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: FAINT }}>
              {role}
            </p>
            <p className="text-sm font-bold leading-tight" style={{ color: INK }}>
              {party.name}
            </p>
            {partyLocal(party, activeLanguages) && (
              <p className="text-xs mb-1.5" style={{ color: SUB }}>
                {partyLocal(party, activeLanguages)}
              </p>
            )}
            <p className="text-[11px] mb-1.5" style={{ color: SUB }}>
              {party.address}
            </p>
            <RedactedField label="Tax ID" value={party.taxId} />
            <RedactedField label="Phone" value={party.phone} />
          </div>
        ))}
      </div>

      <p className="text-[11px] mb-3" style={{ color: SUB }}>
        Terms: {doc.paymentTerm}
      </p>

      <table className="w-full text-xs border-collapse mb-3">
        <thead>
          <tr className="text-left" style={{ borderBottom: `2px solid ${INK}` }}>
            <th className="pb-1.5">{renderLabel(DESCRIPTION_LABEL, activeLanguages)}</th>
            <th className="pb-1.5 text-right">Qty</th>
            <th className="pb-1.5 text-right">Unit Price</th>
            <th className="pb-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lineItems.map((li) => (
            <tr key={li.id} style={{ borderBottom: `1px solid ${LINE_LIGHT}` }}>
              <td className="py-1.5 pr-2">
                {activeLanguages.has("en") && <p className="font-semibold">{li.descriptionEn}</p>}
                {lineDescription(li, activeLanguages) && (
                  <p className="text-[10px]" style={{ color: FAINT }}>
                    {lineDescription(li, activeLanguages)}
                  </p>
                )}
              </td>
              <td className="py-1.5 text-right font-mono">{li.qtyDisplay}</td>
              <td className="py-1.5 text-right font-mono">{li.unitPriceDisplay}</td>
              <td className="py-1.5 text-right font-mono font-semibold">{li.lineTotalDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock doc={doc} boxed />

      <div className="flex items-end justify-between mt-6 pt-3" style={{ borderTop: `1px dashed ${LINE}` }}>
        <p className="text-[9px] max-w-[60%]" style={{ color: FAINT }}>
          {DISCLAIMER}
        </p>
        <div className="w-24 h-24 rounded-full flex items-center justify-center rotate-[-12deg] shrink-0" style={{ border: `4px solid ${ROSE}` }}>
          <span className="text-[9px] font-black text-center leading-tight" style={{ color: ROSE }}>
            {renderLabel(SAMPLE_LABEL, activeLanguages)}
          </span>
        </div>
      </div>
    </>
  );
}

// --- Variant 2: letterhead, full-width banner, no boxes, signature line -----------------------

function LetterheadDocument({ doc, activeLanguages }: BodyProps) {
  return (
    <>
      <div className="-mx-6 -mt-6 mb-5 px-6 py-4" style={{ backgroundColor: INDIGO, color: WHITE }}>
        <p className="text-lg font-black tracking-tight">{renderLabel(ARCHETYPE_TITLE[doc.archetype], activeLanguages)}</p>
        <p className="text-[11px] opacity-80 mt-0.5">{doc.seller.name}</p>
      </div>

      <div className="flex items-center justify-between text-[11px] mb-4" style={{ color: SUB }}>
        <span>
          {doc.documentNumberLabel}: <span className="font-mono" style={{ color: INK }}>{doc.documentNumber}</span>
        </span>
        <span>
          {renderLabel(DATE_LABEL, activeLanguages)}: <span className="font-mono font-bold" style={{ color: INK }}>{doc.issueDateDisplay}</span>
          {doc.dueDateDisplay && (
            <>
              {" · "}
              {renderLabel(DUE_LABEL, activeLanguages)}: <span className="font-mono font-bold" style={{ color: INK }}>{doc.dueDateDisplay}</span>
            </>
          )}
        </span>
      </div>

      <div className="mb-4 text-xs">
        <span className="font-bold" style={{ color: SUB }}>
          {renderLabel(BUYER_LABEL, activeLanguages)}:{" "}
        </span>
        <span className="font-bold" style={{ color: INK }}>
          {doc.buyer.name}
        </span>
        {partyLocal(doc.buyer, activeLanguages) && <span style={{ color: SUB }}> / {partyLocal(doc.buyer, activeLanguages)}</span>}
        <div className="mt-1 flex gap-4">
          <RedactedField label="Tax ID" value={doc.buyer.taxId} />
          <RedactedField label="Phone" value={doc.buyer.phone} />
        </div>
      </div>

      <p className="text-[11px] mb-3" style={{ color: SUB }}>
        Terms: {doc.paymentTerm}
      </p>

      <table className="w-full text-xs border-collapse mb-3">
        <thead>
          <tr className="text-left" style={{ color: SUB }}>
            <th className="pb-1.5 font-semibold">{renderLabel(DESCRIPTION_LABEL, activeLanguages)}</th>
            <th className="pb-1.5 text-right font-semibold">Qty</th>
            <th className="pb-1.5 text-right font-semibold">Unit Price</th>
            <th className="pb-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lineItems.map((li, i) => (
            <tr key={li.id} style={{ backgroundColor: i % 2 === 0 ? "#f8fafc" : WHITE }}>
              <td className="py-1.5 pr-2 pl-1.5">
                {activeLanguages.has("en") && <p className="font-semibold">{li.descriptionEn}</p>}
                {lineDescription(li, activeLanguages) && (
                  <p className="text-[10px]" style={{ color: FAINT }}>
                    {lineDescription(li, activeLanguages)}
                  </p>
                )}
              </td>
              <td className="py-1.5 text-right font-mono">{li.qtyDisplay}</td>
              <td className="py-1.5 text-right font-mono">{li.unitPriceDisplay}</td>
              <td className="py-1.5 pr-1.5 text-right font-mono font-semibold">{li.lineTotalDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock doc={doc} boxed={false} />

      <div className="flex items-end justify-between mt-8 pt-2">
        <p className="text-[9px] max-w-[55%]" style={{ color: FAINT }}>
          {DISCLAIMER}
        </p>
        <div className="text-center">
          <div className="w-36 mb-1" style={{ borderBottom: `1px solid ${INK}` }} />
          <p className="text-[9px]" style={{ color: FAINT }}>
            Authorized signature
          </p>
        </div>
      </div>
    </>
  );
}

// --- Variant 3: compact thermal-receipt style, narrow, dotted leaders --------------------------

function CompactDocument({ doc, activeLanguages }: BodyProps) {
  return (
    <>
      <div className="text-center mb-3">
        <p className="text-sm font-black">{renderLabel(ARCHETYPE_TITLE[doc.archetype], activeLanguages)}</p>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: SUB }}>
          {doc.documentNumber}
        </p>
        <p className="text-[10px] font-mono" style={{ color: SUB }}>
          {doc.issueDateDisplay}
          {doc.dueDateDisplay ? ` · due ${doc.dueDateDisplay}` : ""}
        </p>
      </div>
      <div className="border-t border-dashed mb-2" style={{ borderColor: LINE }} />

      <div className="text-[10px] mb-2 space-y-0.5">
        <p>
          <span style={{ color: FAINT }}>{renderLabel(SELLER_LABEL, activeLanguages)}: </span>
          {doc.seller.name}
        </p>
        <p>
          <span style={{ color: FAINT }}>{renderLabel(BUYER_LABEL, activeLanguages)}: </span>
          {doc.buyer.name}
        </p>
      </div>
      <div className="border-t border-dashed mb-2" style={{ borderColor: LINE }} />

      <div className="space-y-2 mb-2 text-[10px]">
        {doc.lineItems.map((li) => (
          <div key={li.id}>
            <div className="flex justify-between gap-2">
              <span className="font-semibold truncate">{li.descriptionEn}</span>
              <span className="font-mono shrink-0">{li.lineTotalDisplay}</span>
            </div>
            <div className="flex justify-between" style={{ color: FAINT }}>
              <span>
                {li.qtyDisplay} x {li.unitPriceDisplay}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed mb-2" style={{ borderColor: LINE }} />

      <TotalsBlock doc={doc} boxed={false} compact />

      <div className="text-center mt-4">
        <p className="text-[9px] font-black tracking-widest" style={{ color: ROSE }}>
          {renderLabel(SAMPLE_LABEL, activeLanguages)} · TEST ONLY
        </p>
        <p className="text-[8px] mt-1" style={{ color: FAINT }}>
          {DISCLAIMER}
        </p>
      </div>
    </>
  );
}

function TotalsBlock({ doc, boxed, compact }: { doc: GeneratedDocument; boxed: boolean; compact?: boolean }) {
  const rows = (
    <>
      <div className="flex justify-between">
        <span style={{ color: SUB }}>Subtotal</span>
        <span className="font-mono">{doc.totals.subtotalDisplay}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: SUB }}>Tax ({doc.totals.taxRatePct}%)</span>
        <span className="font-mono">{doc.totals.taxDisplay}</span>
      </div>
      {doc.totals.discountDisplay && (
        <div className="flex justify-between">
          <span style={{ color: SUB }}>Less: discount</span>
          <span className="font-mono" style={{ color: ROSE }}>
            {doc.totals.discountDisplay}
          </span>
        </div>
      )}
      <div className={`flex justify-between pt-1 font-black ${compact ? "text-xs" : "text-sm"}`} style={{ borderTop: `2px solid ${INK}` }}>
        <span>Grand Total</span>
        <span className="font-mono">{doc.totals.grandTotalDisplay}</span>
      </div>
    </>
  );

  if (compact) return <div className="text-[10px] space-y-1">{rows}</div>;

  return (
    <div className={boxed ? "flex justify-end" : ""}>
      <div className="w-56 text-xs space-y-1">{rows}</div>
    </div>
  );
}

function LedgerDocument({ doc }: { doc: GeneratedDocument }) {
  return (
    <>
      <div className="flex items-start justify-between pb-3 mb-4" style={{ borderBottom: `2px solid ${INK}` }}>
        <div>
          <p className="text-base font-black">{doc.archetypeLabel}</p>
          <p className="text-[11px] mt-1" style={{ color: SUB }}>
            {doc.documentNumberLabel}: <span className="font-mono">{doc.documentNumber}</span>
          </p>
        </div>
        <p className="text-[11px]" style={{ color: SUB }}>
          {doc.issueDateDisplay}
        </p>
      </div>
      <table className="w-full text-[9px] border-collapse mb-3 table-fixed">
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr className="text-left" style={{ borderBottom: `2px solid ${INK}` }}>
            {doc.ledgerHeaders?.map((h, i) => (
              <th key={i} className="pb-1.5 pr-1.5 align-bottom break-words">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.ledgerRows?.map((row) => (
            <tr
              key={row.id}
              style={{
                color: row.isNoiseRow ? FAINT : INK,
                fontStyle: row.isNoiseRow ? "italic" : "normal",
                borderBottom: row.isNoiseRow ? "none" : `1px solid ${LINE_LIGHT}`,
              }}
            >
              {row.cells.length === 1 ? (
                <td className="py-1 pr-1.5 break-words" colSpan={doc.ledgerHeaders?.length ?? 6}>
                  {row.cells[0]}
                </td>
              ) : (
                row.cells.map((cell, i) => (
                  <td key={i} className="py-1 pr-1.5 break-words">
                    {cell}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[9px]" style={{ color: FAINT }}>
        {DISCLAIMER}
      </p>
    </>
  );
}

interface PhysicalPaperViewProps {
  doc: GeneratedDocument;
  scannerEffect: boolean;
  rotationDeg: number;
  paperRef: React.RefObject<HTMLDivElement | null>;
  activeLanguages: Set<LanguageCode>;
}

export function PhysicalPaperView({ doc, scannerEffect, rotationDeg, paperRef, activeLanguages }: PhysicalPaperViewProps) {
  const width = doc.archetype === "messy_ledger" ? 760 : PAPER_WIDTH[doc.layoutVariant];
  return (
    <div className="overflow-x-auto py-4">
      <div
        ref={paperRef}
        className="relative mx-auto p-6 shadow-xl rounded-sm"
        style={{
          backgroundColor: WHITE,
          color: INK,
          width,
          maxWidth: "100%",
          transform: scannerEffect ? `rotate(${rotationDeg}deg)` : undefined,
        }}
      >
        {scannerEffect && (
          <>
            <div className="scan-noise-overlay" />
            <div className="scan-lighting-overlay" />
            <div className="scan-crease" />
          </>
        )}

        {doc.archetype === "messy_ledger" ? (
          <LedgerDocument doc={doc} />
        ) : doc.layoutVariant === "letterhead" ? (
          <LetterheadDocument doc={doc} activeLanguages={activeLanguages} />
        ) : doc.layoutVariant === "compact" ? (
          <CompactDocument doc={doc} activeLanguages={activeLanguages} />
        ) : (
          <BoxedDocument doc={doc} activeLanguages={activeLanguages} />
        )}
      </div>
    </div>
  );
}
