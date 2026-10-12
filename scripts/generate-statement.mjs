import fs from "fs";
import path from "path";

// =============================================================================
// BizMate AI - MSME 365-Day Financial Statement Generator
// Period: 31 Oct 2025 (2568) to 31 Oct 2026 (2569) - 366 Days (Thailand ICT UTC+7)
// Company: Ploy Select Co., Ltd. (Omnichannel Retail & Cross-Border Importer)
// =============================================================================

const startDate = new Date("2025-10-31T00:00:00+07:00");
const endDate = new Date("2026-10-31T23:59:59+07:00");

function formatDateISO(d, hours, minutes, seconds = 0) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const min = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+07:00`;
}

function roundMoney(val) {
  return Math.round(val * 100) / 100;
}

let seed = 54321;
function pseudoRandom() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

const rawEvents = [];

function registerEvent(dtISO, channel, counterparty, type, amount, category, metadata) {
  rawEvents.push({
    datetime: dtISO,
    channel,
    counterparty_name: counterparty,
    type,
    amount: roundMoney(amount),
    category,
    metadata
  });
}

const curr = new Date(startDate);

while (curr <= endDate) {
  const year = curr.getFullYear();
  const month = curr.getMonth() + 1; // 1-12
  const day = curr.getDate();
  const dayOfWeek = curr.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

  // ---------------------------------------------------------------------------
  // 1. DAILY CASH FLOW: PromptPay QR Retail (300 - 1,500 THB)
  // ---------------------------------------------------------------------------
  if (year === 2026 && month === 10 && day === 10) {
    // Exactly 3 morning QR sales so that Shopee Payout at 14:32 becomes TXN-20261010-004
    registerEvent(formatDateISO(curr, 9, 15, 0), "PromptPay QR Retail", "Walk-in Customer / PromptPay QR", "CREDIT", 450.0, "RETAIL_SALES", {
      terminal_id: "KBANK-EDC-STALL01", qr_trace: "PP-TX-20261010-1", notes: "On-premise retail stall QR receipt"
    });
    registerEvent(formatDateISO(curr, 11, 20, 0), "PromptPay QR Retail", "Walk-in Customer / PromptPay QR", "CREDIT", 680.0, "RETAIL_SALES", {
      terminal_id: "KBANK-EDC-STALL01", qr_trace: "PP-TX-20261010-2", notes: "On-premise retail stall QR receipt"
    });
    registerEvent(formatDateISO(curr, 13, 5, 0), "PromptPay QR Retail", "Walk-in Customer / PromptPay QR", "CREDIT", 370.0, "RETAIL_SALES", {
      terminal_id: "KBANK-EDC-STALL01", qr_trace: "PP-TX-20261010-3", notes: "On-premise retail stall QR receipt"
    });
  } else {
    const count = 1 + Math.floor(pseudoRandom() * 3);
    for (let i = 0; i < count; i++) {
      const h = 10 + Math.floor(pseudoRandom() * 9);
      const m = Math.floor(pseudoRandom() * 59);
      const s = Math.floor(pseudoRandom() * 59);
      const amt = roundMoney(320 + pseudoRandom() * 1150);
      registerEvent(formatDateISO(curr, h, m, s), "PromptPay QR Retail", "Walk-in Customer / PromptPay QR", "CREDIT", amt, "RETAIL_SALES", {
        terminal_id: "KBANK-EDC-STALL01",
        qr_trace: `PP-TX-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}-${i + 1}`,
        notes: "On-premise retail stall QR receipt"
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. WEEKLY PLATFORM PAYOUTS (Shopee, TikTok Shop, Lazada)
  // ---------------------------------------------------------------------------
  // Shopee on Tuesdays
  if (dayOfWeek === 2 && !(year === 2026 && month === 10 && (day === 13 || day === 20))) {
    let amt = 23000 + pseudoRandom() * 6000;
    let isPromo = false;
    let promoLabel = "";
    if (
      (month === 11 && day >= 10 && day <= 17) ||
      (month === 12 && day >= 10 && day <= 17) ||
      (month === 3 && day >= 3 && day <= 10) ||
      (month === 6 && day >= 6 && day <= 13) ||
      (month === 9 && day >= 9 && day <= 16)
    ) {
      amt *= 2.4;
      isPromo = true;
      promoLabel = `${month}.${month} Mega Shopping Festival Surge`;
    }
    registerEvent(formatDateISO(curr, 14, 25, 0), "Shopee Payout", "Shopee (Thailand) Co., Ltd.", "CREDIT", amt, "E-COMMERCE_SETTLEMENT", {
      reference_no: `SP-PAY-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
      campaign_flag: isPromo,
      notes: isPromo ? `Mega Campaign Settlement: ${promoLabel}` : "Weekly marketplace order settlement batch"
    });
  }

  // Exact 2026-10-10 user-specified Shopee payout
  if (year === 2026 && month === 10 && day === 10) {
    registerEvent("2026-10-10T14:32:00+07:00", "Shopee Payout", "Shopee (Thailand) Co., Ltd.", "CREDIT", 25400.0, "E-COMMERCE_SETTLEMENT", {
      reference_no: "SP-PAY-99201",
      notes: "Weekly settlement order range 01-07 Oct"
    });
  }

  // TikTok Shop on Thursdays
  if (dayOfWeek === 4 && !(year === 2026 && month === 10 && day === 15)) {
    let amt = 18500 + pseudoRandom() * 5000;
    let isPromo = false;
    if (
      (month === 11 && day >= 10 && day <= 17) ||
      (month === 12 && day >= 10 && day <= 17) ||
      (month === 3 && day >= 3 && day <= 10) ||
      (month === 6 && day >= 6 && day <= 13) ||
      (month === 9 && day >= 9 && day <= 16)
    ) {
      amt *= 2.2;
      isPromo = true;
    }
    registerEvent(formatDateISO(curr, 15, 10, 0), "TikTok Shop Settlement", "TikTok Pte. Ltd. (Thailand)", "CREDIT", amt, "E-COMMERCE_SETTLEMENT", {
      reference_no: `TTS-BATCH-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
      campaign_flag: isPromo,
      notes: "Live GMV & Affiliate creator commerce payout"
    });
  }

  // Lazada on Fridays
  if (dayOfWeek === 5 && !(year === 2026 && month === 10 && day === 16)) {
    let amt = 15000 + pseudoRandom() * 4500;
    let isPromo = false;
    if (
      (month === 11 && day >= 10 && day <= 17) ||
      (month === 12 && day >= 10 && day <= 17) ||
      (month === 3 && day >= 3 && day <= 10) ||
      (month === 6 && day >= 6 && day <= 13) ||
      (month === 9 && day >= 9 && day <= 16)
    ) {
      amt *= 2.2;
      isPromo = true;
    }
    registerEvent(formatDateISO(curr, 16, 45, 0), "Lazada Partner Portal", "Lazada Express (Thailand) Co., Ltd.", "CREDIT", amt, "E-COMMERCE_SETTLEMENT", {
      reference_no: `LZD-STMT-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
      campaign_flag: isPromo,
      notes: "Weekly merchant sales settlement cycle"
    });
  }

  // October 2026 10.10 Mega Campaign Settlements
  if (year === 2026 && month === 10 && day === 14) {
    registerEvent(formatDateISO(curr, 14, 20, 0), "Shopee Payout", "Shopee (Thailand) Co., Ltd.", "CREDIT", 168000.0, "E-COMMERCE_SETTLEMENT", {
      reference_no: "SP-PAY-1010-MEGA", campaign_flag: true, notes: "Mega Campaign Settlement: 10.10 Mega Shopping Festival Orders"
    });
  }
  if (year === 2026 && month === 10 && day === 15) {
    registerEvent(formatDateISO(curr, 15, 30, 0), "TikTok Shop Settlement", "TikTok Pte. Ltd. (Thailand)", "CREDIT", 135000.0, "E-COMMERCE_SETTLEMENT", {
      reference_no: "TTS-1010-SURGE", campaign_flag: true, notes: "10.10 Super Live Commerce GMV settlement"
    });
  }
  if (year === 2026 && month === 10 && day === 16) {
    registerEvent(formatDateISO(curr, 16, 15, 0), "Lazada Partner Portal", "Lazada Express (Thailand) Co., Ltd.", "CREDIT", 92000.0, "E-COMMERCE_SETTLEMENT", {
      reference_no: "LZD-1010-MEGA", campaign_flag: true, notes: "10.10 Brands Festival order payout"
    });
  }

  // ---------------------------------------------------------------------------
  // 3. B2B BUYER PAYMENT HABITS (Collections Agent Profiling)
  // ---------------------------------------------------------------------------
  // Siam Gadget Hub: Pays on invoice date (around 10th of each month)
  if (day === 10 && !(year === 2026 && month === 10)) {
    const b2bAmount = 45000 + Math.floor(pseudoRandom() * 6000);
    registerEvent(formatDateISO(curr, 11, 45, 0), "K-Biz Corporate Transfer", "Siam Gadget Hub Co., Ltd.", "CREDIT", b2bAmount, "B2B_RECEIVABLE", {
      invoice_no: `INV-B2B-${year}${String(month).padStart(2, "0")}-01`,
      payment_habit: "EXCELLENT",
      delay_days: 0,
      notes: "Wholesale accessories order • Paid exactly on invoice issue date"
    });
  }
  if (year === 2026 && month === 10 && day === 8) {
    registerEvent(formatDateISO(curr, 11, 45, 0), "K-Biz Corporate Transfer", "Siam Gadget Hub Co., Ltd.", "CREDIT", 48000.0, "B2B_RECEIVABLE", {
      invoice_no: "INV-B2B-202610-01",
      payment_habit: "EXCELLENT",
      delay_days: 0,
      notes: "Wholesale accessories order • Paid exactly on invoice issue date"
    });
  }

  // Boutique Siam: Habitual late debtor (regularly pays 21-24 days late)
  if (day === 23 && (year < 2026 || (year === 2026 && month < 10))) {
    const boutiqueAmt = 34000 + Math.floor(pseudoRandom() * 3000);
    registerEvent(formatDateISO(curr, 15, 40, 0), "K-Biz Corporate Transfer", "Boutique Siam Partnership", "CREDIT", boutiqueAmt, "B2B_RECEIVABLE", {
      invoice_no: `INV-BS-${year}${String(month).padStart(2, "0")}`,
      payment_habit: "HABITUAL_LATE",
      delay_days: 22,
      notes: "Boutique consignment payment • Received 22 days past original due date"
    });
  }

  // Oct 2026 Core Scenario: Late invoice recovered on 20 Oct after Collections Agent reminder
  if (year === 2026 && month === 10 && day === 20) {
    registerEvent(formatDateISO(curr, 14, 15, 0), "K-Biz Corporate Transfer", "Boutique Siam Partnership", "CREDIT", 35000.0, "B2B_RECEIVABLE", {
      invoice_no: "INV-BS-202610-01",
      payment_habit: "HABITUAL_LATE",
      delay_days: 19,
      notes: "Consignment invoice overdue • Paid following Collections Agent LINE reminder"
    });
  }

  // ---------------------------------------------------------------------------
  // 4. FIXED COSTS & REGULAR SME EXPENSES
  // ---------------------------------------------------------------------------
  // Rent: 5th of each month (฿28,000)
  if (day === 5) {
    registerEvent(formatDateISO(curr, 10, 0, 0), "Bank Transfer (BAHTNET/K-Biz)", "Siam Prime Properties Co., Ltd.", "DEBIT", 28000.0, "RENT_LEASE", {
      contract_id: `LEASE-BKK-${year}`, notes: "Monthly commercial retail space & warehouse rent"
    });
  }

  // Utilities: 12th of each month (฿4,850)
  if (day === 12) {
    registerEvent(formatDateISO(curr, 11, 20, 0), "Bill Payment (MEA/MWA)", "Metropolitan Electricity & Waterworks Authority", "DEBIT", 4850.0, "UTILITIES", {
      billing_ref: `UTIL-${year}${String(month).padStart(2, "0")}`, notes: "Commercial electricity and water utility payment"
    });
  }

  // Digital Ads: 15th & 28th
  if (day === 15) {
    registerEvent(formatDateISO(curr, 13, 0, 0), "Corporate Credit Card", "Meta Platforms Ireland Ltd.", "DEBIT", 15000.0, "MARKETING_ADVERTISING", {
      ad_account: "ACT-PLOYSELECT-FB01", notes: "Facebook & Instagram targeted advertising spend"
    });
  }
  if (day === 28) {
    registerEvent(formatDateISO(curr, 13, 30, 0), "Corporate Credit Card", "TikTok Ads Pte. Ltd.", "DEBIT", 18000.0, "MARKETING_ADVERTISING", {
      ad_account: "TT-ADV-PLOY-TH", notes: "TikTok Shop short video & creator boost campaigns"
    });
  }

  // Staff Payroll: 28th (฿45,000)
  if (day === 28) {
    registerEvent(formatDateISO(curr, 17, 30, 0), "K-Payroll Bulk Transfer", "Ploy Select Staff Payroll Account", "DEBIT", 45000.0, "PAYROLL_SALARY", {
      batch_no: `PAYROLL-${year}${String(month).padStart(2, "0")}`, headcount: 3, notes: "Monthly full-time staff salaries & social security deductions"
    });
  }

  // Domestic Logistics & Fulfillment (Flash / Kerry): 18th & 30th
  if (day === 18 && !(year === 2026 && month === 10)) {
    registerEvent(formatDateISO(curr, 16, 0, 0), "Bank Transfer (K-Biz)", "Flash Express Logistics Fleet", "DEBIT", 16500.0, "LOGISTICS_FULFILLMENT", {
      batch_id: `LOG-DISPATCH-${year}${String(month).padStart(2, "0")}-A`, notes: "Mid-month bulk e-commerce parcel courier delivery"
    });
  }
  if (day === 30 && !(year === 2026 && month === 10)) {
    registerEvent(formatDateISO(curr, 16, 30, 0), "Bank Transfer (K-Biz)", "Kerry Express (Thailand) Fleet", "DEBIT", 17500.0, "LOGISTICS_FULFILLMENT", {
      batch_id: `LOG-DISPATCH-${year}${String(month).padStart(2, "0")}-B`, notes: "Month-end courier dispatch and shipping fees"
    });
  }

  // Local Packing Supplies & Materials: 7th
  if (day === 7 && !(year === 2026 && month === 10)) {
    registerEvent(formatDateISO(curr, 11, 0, 0), "Bank Transfer (PromptPay Corporate)", "BKK Accessory Supply Ltd., Part.", "DEBIT", 22000.0, "OPERATING_EXPENSES", {
      po_number: `PO-DOM-${year}${String(month).padStart(2, "0")}`, notes: "Retail packing materials, screen protectors & blister packaging"
    });
  }

  // Monthly Customs Import Duty & Freight Handling: 21st (except Oct 2026)
  if (day === 21 && (year < 2026 || (year === 2026 && month < 10))) {
    registerEvent(formatDateISO(curr, 14, 0, 0), "Bank Transfer (K-Biz)", "Siam Ocean Cargo & Customs Clearance", "DEBIT", 28000.0, "LOGISTICS_FULFILLMENT", {
      ref_no: `DUTY-CUSTOMS-${year}${String(month).padStart(2, "0")}`, notes: "Import customs clearance, VAT 7% & ocean freight handling"
    });
  }

  // Monthly Revenue Dept VAT (PP.30): 23rd
  if (day === 23 && (year < 2026 || (year === 2026 && month < 10))) {
    registerEvent(formatDateISO(curr, 11, 0, 0), "E-Tax Payment (RD)", "Revenue Department (Thailand)", "DEBIT", 22000.0, "TAX_STATUTORY", {
      tax_form: `PP30-${year}${String(month).padStart(2, "0")}`, notes: "Monthly Value Added Tax (VAT 7%) e-filing remittance"
    });
  }

  // ---------------------------------------------------------------------------
  // 5. SHENZHEN CHEN TECH (Bi-monthly Verified Cross-Border Trade History)
  // ---------------------------------------------------------------------------
  if (year === 2025 && month === 12 && day === 24) {
    registerEvent(formatDateISO(curr, 10, 30, 0), "Cross-Border Telegraphic Transfer (SWIFT)", "Shenzhen Chen Tech Electronics Co., Ltd.", "DEBIT", 240000.0, "SUPPLIER_PURCHASE", {
      supplier_id: "CHEN-TECH-SZ", cny_amount: 50000.0, fx_rate: 4.8000, recipient_bank: "China Construction Bank (Shenzhen Branch)", verified_registry: true, notes: "Q4 Wholesale electronics procurement • Verified supplier rail"
    });
  }
  if (year === 2026 && month === 2 && day === 24) {
    registerEvent(formatDateISO(curr, 11, 15, 0), "Cross-Border Telegraphic Transfer (SWIFT)", "Shenzhen Chen Tech Electronics Co., Ltd.", "DEBIT", 250000.0, "SUPPLIER_PURCHASE", {
      supplier_id: "CHEN-TECH-SZ", cny_amount: 52000.0, fx_rate: 4.8077, recipient_bank: "China Construction Bank (Shenzhen Branch)", verified_registry: true, notes: "Post-CNY inventory restock • Verified supplier rail"
    });
  }
  if (year === 2026 && month === 4 && day === 24) {
    registerEvent(formatDateISO(curr, 10, 50, 0), "Cross-Border Telegraphic Transfer (SWIFT)", "Shenzhen Chen Tech Electronics Co., Ltd.", "DEBIT", 255000.0, "SUPPLIER_PURCHASE", {
      supplier_id: "CHEN-TECH-SZ", cny_amount: 53000.0, fx_rate: 4.8113, recipient_bank: "China Construction Bank (Shenzhen Branch)", verified_registry: true, notes: "Summer product cycle accessories import • Verified supplier rail"
    });
  }
  if (year === 2026 && month === 6 && day === 24) {
    registerEvent(formatDateISO(curr, 11, 40, 0), "Cross-Border Telegraphic Transfer (SWIFT)", "Shenzhen Chen Tech Electronics Co., Ltd.", "DEBIT", 260000.0, "SUPPLIER_PURCHASE", {
      supplier_id: "CHEN-TECH-SZ", cny_amount: 54000.0, fx_rate: 4.8148, recipient_bank: "China Construction Bank (Shenzhen Branch)", verified_registry: true, notes: "Mid-year campaign inventory import • Verified supplier rail"
    });
  }
  if (year === 2026 && month === 8 && day === 25) {
    registerEvent(formatDateISO(curr, 14, 10, 0), "Cross-Border Telegraphic Transfer (SWIFT)", "Shenzhen Chen Tech Electronics Co., Ltd.", "DEBIT", 250000.0, "SUPPLIER_PURCHASE", {
      supplier_id: "CHEN-TECH-SZ", cny_amount: 52000.0, fx_rate: 4.8077, recipient_bank: "China Construction Bank (Shenzhen Branch)", verified_registry: true, notes: "Pre-9.9 campaign gadget import • Verified supplier rail"
    });
  }

  // ---------------------------------------------------------------------------
  // 6. THE CORE CONFLICT TRIGGER (26 Oct 2026)
  // ¥100,000 pending/critical order (-฿482,500)
  // Drops liquidity to ฿64,000, breaching ฿80,000 Safety Buffer
  // ---------------------------------------------------------------------------
  if (year === 2026 && month === 10 && day === 26) {
    registerEvent(formatDateISO(curr, 10, 0, 0), "Cross-Border Partner FX Rail (Scheduled)", "Shenzhen Chen Tech Electronics Co., Ltd.", "DEBIT", 482500.0, "SUPPLIER_PURCHASE", {
      supplier_id: "CHEN-TECH-SZ",
      cny_amount: 100000.0,
      fx_rate: 4.825,
      recipient_bank: "China Construction Bank (Shenzhen Branch)",
      core_conflict_trigger: true,
      safety_buffer_breach: true,
      safety_buffer_threshold: 80000.0,
      notes: "CRITICAL OUTFLOW: ¥100,000 Q4 Order payment. Dips liquidity below ฿80k buffer."
    });
  }

  // ---------------------------------------------------------------------------
  // 7. SECURITY ANOMALIES & RED FLAGS (True Cost & Trust Agents)
  // ---------------------------------------------------------------------------
  if (year === 2026 && month === 3 && day === 18) {
    registerEvent(formatDateISO(curr, 13, 20, 0), "Email Invoiced Prompt / Wire Blocked", "Shenzhen Chen Tech (Spoofed Entity: Offshore Hong Kong)", "DEBIT", 0.0, "SECURITY_ANOMALY_BLOCKED", {
      red_flag_type: "IMPERSONATED_BANK_ACCOUNT", flagged_by: "True Cost Agent", detected_rule: "REGISTRY_DISCREPANCY",
      original_account: "China Construction Bank (Shenzhen)", spoofed_account: "Hang Seng Bank (Hong Kong) Acct #882-99102",
      status: "BLOCKED_BY_TRUST_AGENT", notes: "Phishing attempt detected: Altered supplier payment coordinates intercepted and hard-blocked."
    });
  }
  if (year === 2026 && month === 7 && day === 14) {
    registerEvent(formatDateISO(curr, 16, 5, 0), "Direct Solicitation / Unlicensed FX Broker", "FastMoney Express / Unlicensed Cross-Border Rail", "CREDIT", 0.0, "SECURITY_ANOMALY_BLOCKED", {
      red_flag_type: "PREDATORY_LENDING_TRAP", advertised_rate: "1% per day", calculated_apr_by_true_cost: 365.0,
      flagged_by: "True Cost Agent", status: "HARD_BLOCKED_POLICY_RULE", notes: "Predatory credit solicitation rejected: True APR calculated at 365%/yr. Violates MSME safety threshold."
    });
  }

  curr.setDate(curr.getDate() + 1);
}

// -----------------------------------------------------------------------------
// MONTHLY RE-BALANCING INVENTORY PROCUREMENTS (Keeps cash in safe MSME zone)
// In a thriving retail SME, surplus operational cash is reinvested into inventory
// batches (fast-moving domestic gadgets) on the 16th of each month.
// -----------------------------------------------------------------------------
// Let's calculate monthly net cash flow without inventory adjustments first:
rawEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

// We want initial balance on 2025-10-31 = ฿185,000.00
const initialStartingBalance = 185000.0;

// Monthly closing target balances (so cash floats smoothly between 120k and 280k):
// Nov: ~180k, Dec: ~160k, Jan: ~200k, Feb: ~170k, Mar: ~210k, Apr: ~175k,
// May: ~220k, Jun: ~180k, Jul: ~230k, Aug: ~170k, Sep: ~220k, Oct 10: 145,000
const monthlyTargets = {
  "2025-11": 180000,
  "2025-12": 160000,
  "2026-01": 210000,
  "2026-02": 170000,
  "2026-03": 210000,
  "2026-04": 175000,
  "2026-05": 220000,
  "2026-06": 180000,
  "2026-07": 225000,
  "2026-08": 170000,
  "2026-09": 145000
};

// Insert calibrated inventory restocks on the 16th of each month to track realistic targets
Object.entries(monthlyTargets).forEach(([yearMonth, targetBalance]) => {
  const [yr, mo] = yearMonth.split("-").map(Number);
  // Calculate projected balance at end of this month
  let bal = initialStartingBalance;
  for (const ev of rawEvents) {
    const evYM = ev.datetime.slice(0, 7);
    if (evYM <= yearMonth) {
      if (ev.type === "CREDIT") bal += ev.amount;
      else bal -= ev.amount;
    }
  }
  const surplus = roundMoney(bal - targetBalance);
  if (surplus > 1000) {
    // Reinvest surplus into wholesale accessories restocking
    const restockDate = `${yearMonth}-16T15:00:00+07:00`;
    rawEvents.push({
      datetime: restockDate,
      channel: "Bank Transfer (BAHTNET)",
      counterparty_name: "Eastern Tech Component Distributors",
      type: "DEBIT",
      amount: surplus,
      category: "SUPPLIER_PURCHASE",
      metadata: {
        po_number: `PO-DOM-RESTOCK-${yr}${String(mo).padStart(2, "0")}`,
        notes: "Monthly fast-moving gadget lines & packaging inventory restocking"
      }
    });
  }
});

// Re-sort chronologically
rawEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

// -----------------------------------------------------------------------------
// OCTOBER 2026 CALIBRATION:
// 1. Balance on 2026-10-10 after Shopee Payout MUST BE EXACTLY ฿145,000.00
// 2. Balance on 2026-10-26 after Chen Tech ¥100k MUST BE EXACTLY ฿64,000.00
// -----------------------------------------------------------------------------

// Calculate balance right before 2026-10-10 Shopee Payout
const oct10ShopeeIdx = rawEvents.findIndex(
  (e) => e.datetime === "2026-10-10T14:32:00+07:00" && e.channel === "Shopee Payout"
);

let balBeforeOct10Shopee = initialStartingBalance;
for (let i = 0; i < oct10ShopeeIdx; i++) {
  const ev = rawEvents[i];
  if (ev.type === "CREDIT") balBeforeOct10Shopee += ev.amount;
  else balBeforeOct10Shopee -= ev.amount;
}
balBeforeOct10Shopee = roundMoney(balBeforeOct10Shopee);

// Shopee payout amount is 25,400. So balance before must be 145,000 - 25,400 = 119,600.00!
const targetBeforeOct10Shopee = 145000.0 - 25400.0;
const oct10Diff = roundMoney(targetBeforeOct10Shopee - balBeforeOct10Shopee);

if (Math.abs(oct10Diff) > 0.01) {
  // Balance on 2026-10-09 evening inventory procurement (after all weekly payouts have settled)
  rawEvents.push({
    datetime: "2026-10-09T17:00:00+07:00",
    channel: "Bank Transfer (K-Biz)",
    counterparty_name: "Eastern Tech Component Distributors",
    type: oct10Diff > 0 ? "CREDIT" : "DEBIT",
    amount: roundMoney(Math.abs(oct10Diff)),
    category: oct10Diff > 0 ? "OPERATING_REBATE" : "SUPPLIER_PURCHASE",
    metadata: {
      notes: "Pre-10.10 supplier trade allowance adjustment and accessories balance reconciliation"
    }
  });
  rawEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

// Now calibrate between Oct 10 and Oct 26:
// Target before Chen Tech on Oct 26 is 546,500.00 (so 546,500 - 482,500 = 64,000.00!)
const newOct10Idx = rawEvents.findIndex(
  (e) => e.datetime === "2026-10-10T14:32:00+07:00" && e.channel === "Shopee Payout"
);
const oct26ChenIdx = rawEvents.findIndex(
  (e) => e.datetime === "2026-10-26T10:00:00+07:00" && e.metadata?.core_conflict_trigger
);

let sumBetween = 0;
for (let i = newOct10Idx + 1; i < oct26ChenIdx; i++) {
  const ev = rawEvents[i];
  if (ev.type === "CREDIT") sumBetween += ev.amount;
  else sumBetween -= ev.amount;
}
const projectedBalBeforeChen = 145000.0 + sumBetween;
const targetBeforeChen = 546500.0;
const oct26Diff = roundMoney(targetBeforeChen - projectedBalBeforeChen);

if (Math.abs(oct26Diff) > 0.01) {
  rawEvents.push({
    datetime: "2026-10-18T16:00:00+07:00",
    channel: "Bank Transfer (K-Biz)",
    counterparty_name: "Flash Express & J&T Logistics Fleet",
    type: oct26Diff < 0 ? "DEBIT" : "CREDIT",
    amount: roundMoney(Math.abs(oct26Diff)),
    category: oct26Diff < 0 ? "LOGISTICS_FULFILLMENT" : "B2B_RECEIVABLE",
    metadata: {
      notes: "Pre-Q4 campaign logistics deposit and packaging bulk supply"
    }
  });
  rawEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

// -----------------------------------------------------------------------------
// BUILD SEQUENTIAL TRANSACTION LEDGER
// -----------------------------------------------------------------------------
let currentBal = initialStartingBalance;
let minBal = currentBal;
let minDate = "";

const transactions = [];
const dayCounters = {};

rawEvents.forEach((ev) => {
  const dateKey = ev.datetime.split("T")[0].replace(/-/g, "");
  dayCounters[dateKey] = (dayCounters[dateKey] || 0) + 1;
  const seq = dayCounters[dateKey];
  const txnId = `TXN-${dateKey}-${String(seq).padStart(3, "0")}`;

  if (ev.type === "CREDIT") {
    currentBal += ev.amount;
  } else {
    currentBal -= ev.amount;
  }
  currentBal = roundMoney(currentBal);

  if (currentBal < minBal) {
    minBal = currentBal;
    minDate = ev.datetime;
  }

  transactions.push({
    txn_id: txnId,
    datetime: ev.datetime,
    channel: ev.channel,
    counterparty_name: ev.counterparty_name,
    type: ev.type,
    amount: ev.amount,
    balance_after: currentBal,
    category: ev.category,
    metadata: ev.metadata
  });
});

console.log(`Transactions Count: ${transactions.length}`);
console.log(`Starting Balance (2025-10-31): ฿${initialStartingBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`);
console.log(`Minimum Balance: ฿${minBal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} at ${minDate}`);
console.log(`Ending Balance (2026-10-31): ฿${currentBal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`);

// Verify exact target transactions:
const target1 = transactions.find((t) => t.datetime === "2026-10-10T14:32:00+07:00");
console.log("\nTarget 1 (2026-10-10 Shopee Payout):", target1);

const target2 = transactions.find(
  (t) => t.datetime.startsWith("2026-10-26") && t.counterparty_name.includes("Shenzhen Chen Tech")
);
console.log("\nTarget 2 (2026-10-26 Shenzhen Chen Tech Outflow):", target2);

// Save output
const outPath = path.join(process.cwd(), "data", "mock_financial_statement_365d.json");
fs.writeFileSync(outPath, JSON.stringify(transactions, null, 2), "utf8");
console.log(`\nSuccessfully saved to: ${outPath}`);
