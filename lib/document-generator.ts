// Core randomizer for the Mock Document & Chaos Data Generator (/dashboard/generator). Pure
// TypeScript, no React/DOM, so it's independently testable. Every call to generateMockDocument()
// must produce genuinely new output: no seed parameter exists, Math.random() is called fresh
// every time, and nothing here should ever be memoized by a caller against a stable key.
//
// Math is always correct by construction: lineTotal = qty * unitPrice, grandTotal = subtotal +
// taxAmount - discount, computed bottom-up. Chaos only ever changes how a value is DISPLAYED
// (date format, currency notation, unit), never the underlying numeric truth, so the AI-extraction
// ground truth stays valid even at maximum chaos.

import { COMPANY } from "@/app/data/supplier-copilot-mock";
import {
  CHINA_ENTITIES,
  THAILAND_ENTITIES,
  LINE_ITEMS,
  IDENTIFIER_FORMATS,
  PAYMENT_TERMS,
  type BilingualEntity,
  type IdentifierFormat,
  type IdentifierKind,
} from "@/app/data/generator-vocab";

export type Archetype = "po" | "supplier_invoice" | "receivable_invoice" | "messy_ledger";

// Three genuinely different visual structures, not just re-skinned colors, so the physical paper
// view actually looks like it came from different companies/systems, not one template with new
// text dropped in. Picked at random for every non-ledger document (the ledger has its own fixed
// table shape, a messy spreadsheet export doesn't have a "letterhead").
export type LayoutVariant = "boxed" | "letterhead" | "compact";

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  po: "Purchase order",
  supplier_invoice: "Supplier invoice",
  receivable_invoice: "Overdue tax invoice",
  messy_ledger: "Messy raw ledger",
};

export interface GeneratedParty {
  name: string;
  nameLocal?: string;
  taxId: string;
  phone: string;
  address: string;
  isHomeCompany: boolean;
  localLang?: "zh" | "th";
}

export interface GeneratedLineItem {
  id: string;
  descriptionEn: string;
  descriptionZh: string;
  descriptionTh: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  qtyDisplay: string;
  unitPriceDisplay: string;
  lineTotalDisplay: string;
}

export interface GeneratedTotals {
  subtotal: number;
  taxRatePct: number;
  taxAmount: number;
  discountAmount: number; // 0 unless a chaos roll adds an early-payment discount line
  grandTotal: number;
  currencySymbol: string;
  subtotalDisplay: string;
  taxDisplay: string;
  discountDisplay?: string; // negative-parenthesis notation when discountAmount > 0
  grandTotalDisplay: string;
}

export interface LedgerRow {
  id: string;
  cells: string[];
  isNoiseRow: boolean;
}

export interface GroundTruthFields {
  documentNumber: string;
  issueDate: string;
  buyerName: string;
  sellerName: string;
  grandTotal: number;
  currencySymbol: string;
  lineItemCount: number;
}

export interface GeneratedDocument {
  id: string;
  archetype: Archetype;
  archetypeLabel: string;
  layoutVariant: LayoutVariant;
  documentNumber: string;
  documentNumberLabel: string;
  issueDateIso: string;
  issueDateDisplay: string;
  dueDateIso?: string;
  dueDateDisplay?: string;
  buyer: GeneratedParty;
  seller: GeneratedParty;
  lineItems: GeneratedLineItem[];
  totals: GeneratedTotals;
  ledgerHeaders?: string[];
  ledgerRows?: LedgerRow[];
  paymentTerm: string;
  chaosLevel: number;
  chaosEffectsApplied: string[];
  groundTruth: GroundTruthFields;
}

// --- random primitives -----------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function rollChaos(chaosLevel: number): boolean {
  return Math.random() * 100 < chaosLevel;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randomLetters(n: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < n; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function substituteTemplate(pattern: string): string {
  return pattern.replace(/\{YYYY\}|\{MM\}|\{DD\}|\{D(\d+)\}|\{A(\d+)\}/g, (match, dGroup, aGroup) => {
    if (match === "{YYYY}") return String(randInt(2024, 2027));
    if (match === "{MM}") return String(randInt(1, 12)).padStart(2, "0");
    if (match === "{DD}") return String(randInt(1, 28)).padStart(2, "0");
    if (dGroup) return randomDigits(Number(dGroup));
    if (aGroup) return randomLetters(Number(aGroup));
    return match;
  });
}

// --- dates -------------------------------------------------------------------------------------

const REFERENCE_DATE = new Date(Date.UTC(2026, 9, 17)); // 17 Oct 2026, matches COMPANY.asOf

function randomDate(offsetMinDays: number, offsetMaxDays: number): Date {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + randInt(offsetMinDays, offsetMaxDays));
  return d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type DateFormatHint = "iso" | "cn_ymd" | "th_be" | "dmy";

function pickDateFormat(chaosLevel: number): DateFormatHint {
  const exoticChance = Math.min(0.7, chaosLevel / 150);
  if (Math.random() < exoticChance) return Math.random() < 0.5 ? "cn_ymd" : "th_be";
  return Math.random() < 0.5 ? "iso" : "dmy";
}

function formatDate(d: Date, hint: DateFormatHint): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  switch (hint) {
    case "cn_ymd":
      return `${y}年${m}月${day}日`;
    case "th_be":
      return `${day}/${m}/${y + 543}`;
    case "dmy":
      return `${day}/${m}/${y}`;
    case "iso":
    default:
      return `${y}-${m}-${day}`;
  }
}

// --- currency / number chaos --------------------------------------------------------------

function currencyForCountry(country: "CN" | "TH"): string {
  return country === "CN" ? "¥" : "฿";
}

function formatPlainCurrency(amount: number, currencySymbol: string): string {
  return `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatChaosCurrency(amount: number, currencySymbol: string, chaosLevel: number): string {
  if (!rollChaos(chaosLevel)) return formatPlainCurrency(amount, currencySymbol);

  if (currencySymbol === "¥" && amount >= 10000 && Math.random() < 0.5) {
    return `${round2(amount / 10000).toLocaleString()}万`;
  }
  if (currencySymbol === "฿" && Math.random() < 0.5) {
    return `฿${Math.round(amount).toLocaleString()}.-`;
  }
  return formatPlainCurrency(amount, currencySymbol);
}

function formatNegativeParens(amount: number, currencySymbol: string): string {
  return `(${formatPlainCurrency(amount, currencySymbol)})`;
}

// --- parties -------------------------------------------------------------------------------

function homeTaxId(): string {
  const fmt = IDENTIFIER_FORMATS.find((f) => f.id === "id-2") as IdentifierFormat;
  return substituteTemplate(fmt.pattern);
}

// No Chinese name exists for COMPANY in app/data/supplier-copilot-mock.ts, so this is a
// plausible back-translation used only for this generator's bilingual display.
const HOME_COMPANY_NAME_ZH = "深圳龙鼎精密制造有限公司";

function buildHomeParty(): GeneratedParty {
  return {
    name: COMPANY.name,
    nameLocal: HOME_COMPANY_NAME_ZH,
    localLang: "zh",
    taxId: homeTaxId(),
    phone: `+86 1${randomDigits(2)} ${randomDigits(4)} ${randomDigits(4)}`,
    address: "No. 18 Gongye 2nd Road, Baoan District, Shenzhen, Guangdong, China",
    isHomeCompany: true,
  };
}

function buildEntityParty(entity: BilingualEntity): GeneratedParty {
  const taxFmt =
    IDENTIFIER_FORMATS.find((f) => f.kind === "tax_id" && f.country === entity.country && f.id !== "id-2") ??
    IDENTIFIER_FORMATS.find((f) => f.kind === "tax_id")!;
  const phone =
    entity.country === "CN"
      ? `+86 1${randomDigits(2)} ${randomDigits(4)} ${randomDigits(4)}`
      : `+66 ${randomDigits(1)} ${randomDigits(4)} ${randomDigits(4)}`;
  const address =
    entity.country === "CN"
      ? `Industrial Zone, ${entity.nameEn.split(" ")[0]} District, Guangdong, China`
      : `Industrial Estate, ${entity.nameEn.split(" ")[0]} Province, Thailand`;
  return {
    name: entity.nameEn,
    nameLocal: entity.nameLocal,
    localLang: entity.country === "CN" ? "zh" : "th",
    taxId: substituteTemplate(taxFmt.pattern),
    phone,
    address,
    isHomeCompany: false,
  };
}

function randomEntity(): BilingualEntity {
  return Math.random() < 0.5 ? pick(CHINA_ENTITIES) : pick(THAILAND_ENTITIES);
}

// --- document number -------------------------------------------------------------------------

const ARCHETYPE_IDENTIFIER_KINDS: Record<Exclude<Archetype, "messy_ledger">, IdentifierKind[]> = {
  po: ["po_no"],
  supplier_invoice: ["invoice_no", "bl_no", "delivery_no"],
  receivable_invoice: ["invoice_no", "tax_id"],
};

function buildDocumentNumber(archetype: Exclude<Archetype, "messy_ledger">): { number: string; label: string } {
  const kinds = ARCHETYPE_IDENTIFIER_KINDS[archetype];
  const candidates = IDENTIFIER_FORMATS.filter((f) => kinds.includes(f.kind));
  const fmt = pick(candidates.length > 0 ? candidates : IDENTIFIER_FORMATS);
  return { number: substituteTemplate(fmt.pattern), label: fmt.label };
}

// --- line items ------------------------------------------------------------------------------

const UNIT_PRICE_RANGE: Record<string, [number, number]> = {
  MT: [2800, 22000],
  kg: [18, 320],
  pcs: [0.8, 65],
  m: [4, 95],
};

const QTY_RANGE: Record<string, [number, number]> = {
  MT: [3, 280],
  kg: [120, 6000],
  pcs: [40, 6000],
  m: [60, 2200],
};

function buildLineItems(count: number, chaosLevel: number, currencySymbol: string): GeneratedLineItem[] {
  return Array.from({ length: count }, () => {
    const vocab = pick(LINE_ITEMS);
    const [qMin, qMax] = QTY_RANGE[vocab.unit] ?? [10, 1000];
    const [pMin, pMax] = UNIT_PRICE_RANGE[vocab.unit] ?? [1, 100];
    const qty = round2(randFloat(qMin, qMax));
    const unitPrice = round2(randFloat(pMin, pMax));
    const lineTotal = round2(qty * unitPrice);

    let qtyDisplay = `${qty.toLocaleString()} ${vocab.unit}`;
    if (vocab.unit === "MT" && rollChaos(chaosLevel) && Math.random() < 0.5) {
      qtyDisplay = `${qty.toLocaleString()} MT / ${Math.round(qty * 1000).toLocaleString()} kg`;
    }

    return {
      id: `li-${Math.random().toString(36).slice(2, 9)}`,
      descriptionEn: vocab.descriptionEn,
      descriptionZh: vocab.descriptionZh,
      descriptionTh: vocab.descriptionTh,
      unit: vocab.unit,
      qty,
      unitPrice,
      lineTotal,
      qtyDisplay,
      unitPriceDisplay: formatPlainCurrency(unitPrice, currencySymbol),
      lineTotalDisplay: formatChaosCurrency(lineTotal, currencySymbol, chaosLevel),
    };
  });
}

function computeTotals(lineItems: GeneratedLineItem[], chaosLevel: number, currencySymbol: string): GeneratedTotals {
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.lineTotal, 0));
  const taxRatePct = currencySymbol === "¥" ? pick([6, 9, 13]) : currencySymbol === "฿" ? 7 : 0;
  const taxAmount = round2((subtotal * taxRatePct) / 100);

  let discountAmount = 0;
  let discountDisplay: string | undefined;
  if (rollChaos(chaosLevel) && chaosLevel > 40) {
    discountAmount = round2(subtotal * 0.02);
    discountDisplay = formatNegativeParens(discountAmount, currencySymbol);
  }

  const grandTotal = round2(subtotal + taxAmount - discountAmount);

  return {
    subtotal,
    taxRatePct,
    taxAmount,
    discountAmount,
    grandTotal,
    currencySymbol,
    subtotalDisplay: formatPlainCurrency(subtotal, currencySymbol),
    taxDisplay: formatPlainCurrency(taxAmount, currencySymbol),
    discountDisplay,
    grandTotalDisplay: formatChaosCurrency(grandTotal, currencySymbol, chaosLevel),
  };
}

// --- messy ledger (archetype D) ---------------------------------------------------------------

const LEDGER_HEADERS = ["Date / วันที่ / 日期", "Counterparty", "Description", "Qty", "Unit Price", "Amount"];

function buildLedgerRows(
  chaosLevel: number,
  currencySymbol: string
): { headers: string[]; rows: LedgerRow[]; grandTotal: number; lineItemCount: number } {
  const dataRowCount = randInt(8, 15);
  const rows: LedgerRow[] = [];
  let total = 0;

  rows.push({ id: "n-title", cells: [`${COMPANY.name} — raw export, unverified`], isNoiseRow: true });
  rows.push({ id: "n-blank-1", cells: [""], isNoiseRow: true });
  rows.push({ id: "n-header", cells: [...LEDGER_HEADERS], isNoiseRow: true });

  for (let i = 0; i < dataRowCount; i++) {
    const entity = randomEntity();
    const vocab = pick(LINE_ITEMS);
    const [qMin, qMax] = QTY_RANGE[vocab.unit] ?? [10, 1000];
    const [pMin, pMax] = UNIT_PRICE_RANGE[vocab.unit] ?? [1, 100];
    const qty = round2(randFloat(qMin, qMax));
    const unitPrice = round2(randFloat(pMin, pMax));
    const amount = round2(qty * unitPrice);
    total += amount;

    const dateHint = pickDateFormat(chaosLevel);
    const dateDisplay = formatDate(randomDate(-90, 0), dateHint);
    const amountDisplay = formatChaosCurrency(amount, currencySymbol, chaosLevel);
    const qtyDisplay = rollChaos(chaosLevel) ? `${qty}` : `${qty.toLocaleString()} ${vocab.unit}`;

    rows.push({
      id: `d-${i}`,
      cells: [dateDisplay, entity.nameEn, vocab.descriptionEn, qtyDisplay, formatPlainCurrency(unitPrice, currencySymbol), amountDisplay],
      isNoiseRow: false,
    });

    // Occasional noise: a stray blank row or a duplicated header row jammed mid-sheet.
    if (rollChaos(chaosLevel / 2) && i > 2 && i < dataRowCount - 1) {
      rows.push({ id: `n-mid-${i}`, cells: [""], isNoiseRow: true });
    }
  }

  rows.push({ id: "n-blank-2", cells: [""], isNoiseRow: true });
  rows.push({ id: "n-total", cells: ["", "", "", "", "TOTAL (unverified)", formatPlainCurrency(round2(total), currencySymbol)], isNoiseRow: true });

  return { headers: LEDGER_HEADERS, rows, grandTotal: round2(total), lineItemCount: dataRowCount };
}

// --- main entry point -------------------------------------------------------------------------

export function generateMockDocument(chaosLevel: number): GeneratedDocument {
  const archetype = pick<Archetype>(["po", "supplier_invoice", "receivable_invoice", "messy_ledger"]);
  const id = Math.random().toString(36).slice(2, 10);
  const layoutVariant = pick<LayoutVariant>(["boxed", "letterhead", "compact"]);
  const chaosEffectsApplied: string[] = [];

  if (archetype === "messy_ledger") {
    const currencySymbol = currencyForCountry(Math.random() < 0.5 ? "CN" : "TH");
    const { headers, rows, grandTotal, lineItemCount } = buildLedgerRows(chaosLevel, currencySymbol);
    const issueDate = randomDate(-10, 0);
    chaosEffectsApplied.push("mixed date formats per row", "noise/title rows mixed with data rows");

    const homeParty = buildHomeParty();
    return {
      id,
      archetype,
      archetypeLabel: ARCHETYPE_LABEL[archetype],
      layoutVariant: "boxed",
      documentNumber: `ledger_export_${randInt(2024, 2027)}_raw.csv`,
      documentNumberLabel: "Raw export filename",
      issueDateIso: toIso(issueDate),
      issueDateDisplay: formatDate(issueDate, "iso"),
      buyer: homeParty,
      seller: homeParty,
      lineItems: [],
      totals: {
        subtotal: grandTotal,
        taxRatePct: 0,
        taxAmount: 0,
        discountAmount: 0,
        grandTotal,
        currencySymbol,
        subtotalDisplay: formatPlainCurrency(grandTotal, currencySymbol),
        taxDisplay: formatPlainCurrency(0, currencySymbol),
        grandTotalDisplay: formatPlainCurrency(grandTotal, currencySymbol),
      },
      ledgerHeaders: headers,
      ledgerRows: rows,
      paymentTerm: "N/A, raw ledger export",
      chaosLevel,
      chaosEffectsApplied,
      groundTruth: {
        documentNumber: `ledger_export_${id}_raw.csv`,
        issueDate: toIso(issueDate),
        buyerName: COMPANY.name,
        sellerName: "Multiple counterparties",
        grandTotal,
        currencySymbol,
        lineItemCount,
      },
    };
  }

  const entity = randomEntity();
  const entityParty = buildEntityParty(entity);
  const homeParty = buildHomeParty();

  let buyer: GeneratedParty;
  let seller: GeneratedParty;
  if (archetype === "po") {
    buyer = entityParty;
    seller = homeParty;
  } else if (archetype === "supplier_invoice") {
    buyer = homeParty;
    seller = entityParty;
  } else {
    buyer = entityParty;
    seller = homeParty;
  }

  const currencySymbol = currencyForCountry(entity.country);
  const lineItems = buildLineItems(randInt(2, 5), chaosLevel, currencySymbol);
  const totals = computeTotals(lineItems, chaosLevel, currencySymbol);
  const { number: documentNumber, label: documentNumberLabel } = buildDocumentNumber(archetype);

  const issueDate = randomDate(-45, 0);
  const paymentTermEntry = pick(PAYMENT_TERMS.filter((t) => !t.dateFormatHint));
  const termDays = archetype === "po" ? 45 : archetype === "supplier_invoice" ? 60 : 30;
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + termDays);

  const dateFormat = pickDateFormat(chaosLevel);
  if (dateFormat !== "iso") chaosEffectsApplied.push(`date shown as ${dateFormat}`);
  if (totals.discountAmount > 0) chaosEffectsApplied.push("early-payment discount in negative-parenthesis notation");
  if (currencySymbol === "¥" && totals.grandTotalDisplay.includes("万")) chaosEffectsApplied.push("grand total in 万 (myriad) notation");
  if (currencySymbol === "฿" && totals.grandTotalDisplay.endsWith(".-")) chaosEffectsApplied.push("Baht trailing dash notation");

  return {
    id,
    archetype,
    archetypeLabel: ARCHETYPE_LABEL[archetype],
    layoutVariant,
    documentNumber,
    documentNumberLabel,
    issueDateIso: toIso(issueDate),
    issueDateDisplay: formatDate(issueDate, dateFormat),
    dueDateIso: toIso(dueDate),
    dueDateDisplay: formatDate(dueDate, dateFormat),
    buyer,
    seller,
    lineItems,
    totals,
    paymentTerm: paymentTermEntry.label,
    chaosLevel,
    chaosEffectsApplied,
    groundTruth: {
      documentNumber,
      issueDate: toIso(issueDate),
      buyerName: buyer.name,
      sellerName: seller.name,
      grandTotal: totals.grandTotal,
      currencySymbol,
      lineItemCount: lineItems.length,
    },
  };
}
