// Hand-written CSV serialization for the Mock Document generator's "Export as CSV" button. No
// library needed, the shape is small and the escaping rule is simple (RFC 4180).

import type { GeneratedDocument } from "./document-generator";

export function documentToCsvRows(doc: GeneratedDocument): string[][] {
  if (doc.archetype === "messy_ledger" && doc.ledgerRows) {
    return doc.ledgerRows.map((row) => row.cells);
  }

  const rows: string[][] = [
    ["Document No.", doc.documentNumber],
    ["Date", doc.issueDateDisplay],
    ["Buyer", doc.buyer.name],
    ["Seller", doc.seller.name],
    ["Payment term", doc.paymentTerm],
    [],
    ["Description", "Unit", "Qty", "Unit Price", "Line Total"],
    ...doc.lineItems.map((li) => [
      li.descriptionEn,
      li.unit,
      String(li.qty),
      String(li.unitPrice),
      String(li.lineTotal),
    ]),
    [],
    ["Subtotal", "", "", "", String(doc.totals.subtotal)],
    ["Tax", "", "", "", String(doc.totals.taxAmount)],
    ["Grand total", "", "", "", String(doc.totals.grandTotal)],
  ];

  return rows;
}

function escapeCsvCell(cell: string): string {
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function csvRowsToString(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
