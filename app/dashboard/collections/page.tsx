"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";

interface ReceivableInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  settledDate?: string;
  amount: number;
  status: "OVERDUE" | "UPCOMING" | "PAID";
  delayDays: number;
  habit: "HABITUAL_LATE" | "EXCELLENT";
  habitDescription: string;
  channel: string;
  notes: string;
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string;
  }>;
}

interface BankCollectionsConfig {
  bankId: string;
  bankName: string;
  companyName: string;
  invoices: ReceivableInvoice[];
}

const BANK_COLLECTIONS_DATA: Record<string, BankCollectionsConfig> = {
  kbank: {
    bankId: "kbank",
    bankName: "Kasikornbank Operating Account",
    companyName: "Ploy Select Co., Ltd.",
    invoices: [
      {
        id: "inv-kbank-1",
        invoiceNo: "INV-BS-202610-01",
        customerName: "Boutique Siam Partnership",
        issueDate: "2026-09-18",
        dueDate: "2026-09-30",
        amount: 35000,
        status: "OVERDUE",
        delayDays: 21,
        habit: "HABITUAL_LATE",
        habitDescription: "Usually pays 21 days late after polite reminder",
        channel: "B2B Consignment",
        notes: "Consignment merchandise batch #4. Retail sales confirmed.",
        auditTrail: [
          { timestamp: "2026-09-18 09:00", action: "Invoice created & dispatched to partner", actor: "Billing Department" },
          { timestamp: "2026-09-30 23:59", action: "Payment due date passed without settlement", actor: "Automated Ledger" },
          { timestamp: "2026-10-12 09:41", action: "Collections Agent surfaced ฿35,000 overdue invoice (21 days late)", actor: "Collections Agent" },
          { timestamp: "2026-10-12 09:42", action: "Drafted polite reminder for LINE OA channel dispatch", actor: "Collections Agent" },
        ],
      },
      {
        id: "inv-kbank-2",
        invoiceNo: "INV-SGH-202611",
        customerName: "Siam Gadget Hub Co., Ltd.",
        issueDate: "2026-10-08",
        dueDate: "2026-11-08",
        amount: 48000,
        status: "UPCOMING",
        delayDays: 0,
        habit: "EXCELLENT",
        habitDescription: "Consistently settles on or before due date (0 days delay)",
        channel: "Direct Wholesale",
        notes: "Accessories wholesale order for central branch distribution.",
        auditTrail: [
          { timestamp: "2026-10-08 11:45", action: "Wholesale invoice issued with 30-day payment term", actor: "Billing Department" },
          { timestamp: "2026-10-08 11:46", action: "Telemetry synced with Cash Radar projection", actor: "Cash Agent" },
        ],
      },
      {
        id: "inv-kbank-3",
        invoiceNo: "INV-BS-202609",
        customerName: "Boutique Siam Partnership",
        issueDate: "2026-08-20",
        dueDate: "2026-09-01",
        settledDate: "2026-09-23",
        amount: 34758,
        status: "PAID",
        delayDays: 22,
        habit: "HABITUAL_LATE",
        habitDescription: "Settled 22 days past original due date",
        channel: "B2B Consignment",
        notes: "Previous consignment settlement received via bank transfer.",
        auditTrail: [
          { timestamp: "2026-08-20 10:00", action: "Consignment invoice issued", actor: "Billing Department" },
          { timestamp: "2026-09-01 23:59", action: "Due date passed", actor: "Ledger" },
          { timestamp: "2026-09-23 15:40", action: "Settlement received in full (฿34,758)", actor: "Bank Deposit Sync" },
        ],
      },
      {
        id: "inv-kbank-4",
        invoiceNo: "INV-SGH-202610",
        customerName: "Siam Gadget Hub Co., Ltd.",
        issueDate: "2026-09-10",
        dueDate: "2026-10-10",
        settledDate: "2026-10-08",
        amount: 48000,
        status: "PAID",
        delayDays: 0,
        habit: "EXCELLENT",
        habitDescription: "Paid exactly on schedule",
        channel: "Direct Wholesale",
        notes: "Prompt payment received via partner clearing.",
        auditTrail: [
          { timestamp: "2026-09-10 11:00", action: "Invoice dispatched", actor: "Billing Department" },
          { timestamp: "2026-10-08 11:45", action: "Full payment received prior to due date", actor: "Bank Deposit Sync" },
        ],
      },
    ],
  },
  scb: {
    bankId: "scb",
    bankName: "Siam Commercial Bank Corporate",
    companyName: "Apex Craft Furniture & Interior Co., Ltd.",
    invoices: [
      {
        id: "inv-scb-1",
        invoiceNo: "TLD-INV-4402",
        customerName: "Tokyo Living Design Studio Ltd.",
        issueDate: "2026-09-12",
        dueDate: "2026-09-28",
        amount: 64750,
        status: "OVERDUE",
        delayDays: 22,
        habit: "HABITUAL_LATE",
        habitDescription: "Commercial design contracts usually settle 22 days post-inspection",
        channel: "Corporate Fitout Contract",
        notes: "Custom teak interior fitout milestone payment for Sukhumvit showroom project.",
        auditTrail: [
          { timestamp: "2026-09-12 14:00", action: "Milestone invoice issued upon delivery", actor: "Project Billing" },
          { timestamp: "2026-09-28 23:59", action: "Milestone term expired without payment", actor: "Automated Ledger" },
          { timestamp: "2026-10-12 09:41", action: "Collections Agent flagged ฿64,750 overdue balance", actor: "Collections Agent" },
        ],
      },
      {
        id: "inv-scb-2",
        invoiceNo: "INV-SHR-202611",
        customerName: "Siam Hospitality & Resorts Group",
        issueDate: "2026-10-08",
        dueDate: "2026-11-08",
        amount: 88800,
        status: "UPCOMING",
        delayDays: 0,
        habit: "EXCELLENT",
        habitDescription: "Corporate hotel client settles strictly on net-30 terms",
        channel: "Hospitality Procurement",
        notes: "Furnishing contract for Hua Hin resort phase 2 villas.",
        auditTrail: [
          { timestamp: "2026-10-08 11:45", action: "Contract invoice verified & delivered", actor: "Billing Department" },
        ],
      },
      {
        id: "inv-scb-3",
        invoiceNo: "TLD-INV-4389",
        customerName: "Tokyo Living Design Studio Ltd.",
        issueDate: "2026-08-15",
        dueDate: "2026-09-01",
        settledDate: "2026-09-23",
        amount: 64302,
        status: "PAID",
        delayDays: 22,
        habit: "HABITUAL_LATE",
        habitDescription: "Settled 22 days past original due date",
        channel: "Corporate Fitout Contract",
        notes: "Prior showroom delivery phase settlement.",
        auditTrail: [
          { timestamp: "2026-08-15 10:00", action: "Invoice dispatched", actor: "Project Billing" },
          { timestamp: "2026-09-23 15:40", action: "Payment cleared via SCB corporate wire", actor: "Bank Deposit Sync" },
        ],
      },
    ],
  },
  bbl: {
    bankId: "bbl",
    bankName: "Bangkok Bank iCash Operating",
    companyName: "BioHarvest Agro Tech Co., Ltd.",
    invoices: [
      {
        id: "inv-bbl-1",
        invoiceNo: "CPF-AGRO-901",
        customerName: "Chao Phraya Farm Network Partnership",
        issueDate: "2026-09-15",
        dueDate: "2026-10-01",
        amount: 47250,
        status: "OVERDUE",
        delayDays: 19,
        habit: "HABITUAL_LATE",
        habitDescription: "Wholesale agricultural partners usually pay 19-22 days past invoice",
        channel: "Agro Distribution",
        notes: "Precision nutrient formulation delivery batch #12.",
        auditTrail: [
          { timestamp: "2026-09-15 08:30", action: "Warehouse dispatch note converted to AR invoice", actor: "Supply Chain Billing" },
          { timestamp: "2026-10-01 23:59", action: "Payment grace period ended", actor: "Automated Ledger" },
          { timestamp: "2026-10-12 09:41", action: "Collections Agent prioritized for courteous LINE notification", actor: "Collections Agent" },
        ],
      },
      {
        id: "inv-bbl-2",
        invoiceNo: "INV-GVH-202611",
        customerName: "Green Valley Hydroponic Co., Ltd.",
        issueDate: "2026-10-08",
        dueDate: "2026-11-08",
        amount: 64800,
        status: "UPCOMING",
        delayDays: 0,
        habit: "EXCELLENT",
        habitDescription: "Prompt electronic payment habit via BBL iCash",
        channel: "Commercial Grower Supply",
        notes: "Automated greenhouse monitoring sensor supply.",
        auditTrail: [
          { timestamp: "2026-10-08 11:45", action: "Scheduled electronic bill presentment", actor: "BBL iCash Gateway" },
        ],
      },
      {
        id: "inv-bbl-3",
        invoiceNo: "CPF-AGRO-882",
        customerName: "Chao Phraya Farm Network Partnership",
        issueDate: "2026-08-18",
        dueDate: "2026-09-01",
        settledDate: "2026-09-23",
        amount: 46923,
        status: "PAID",
        delayDays: 22,
        habit: "HABITUAL_LATE",
        habitDescription: "Settled 22 days past term",
        channel: "Agro Distribution",
        notes: "August fertilizer delivery cleared in full.",
        auditTrail: [
          { timestamp: "2026-08-18 09:00", action: "Invoice generated", actor: "Supply Chain Billing" },
          { timestamp: "2026-09-23 15:40", action: "Deposit settled via BBL iCash", actor: "Bank Deposit Sync" },
        ],
      },
    ],
  },
  personal: {
    bankId: "personal",
    bankName: "Kasikornbank Personal Savings (3 Months)",
    companyName: "Kittisak Somchai (Freelance Creator)",
    invoices: [
      {
        id: "inv-personal-1",
        invoiceNo: "INV-DEV-202610",
        customerName: "Client Web Development Transfer",
        issueDate: "2026-09-25",
        dueDate: "2026-10-05",
        amount: 30240,
        status: "OVERDUE",
        delayDays: 14,
        habit: "HABITUAL_LATE",
        habitDescription: "Freelance web development client requires periodic polite nudge",
        channel: "Freelance Direct Transfer",
        notes: "Full-stack web application development milestone #2 deliverable.",
        auditTrail: [
          { timestamp: "2026-09-25 18:00", action: "Invoice sent to client", actor: "Freelance Portal" },
          { timestamp: "2026-10-05 23:59", action: "Contractual term passed", actor: "Ledger" },
          { timestamp: "2026-10-12 09:41", action: "Collections Agent prepared LINE reminder", actor: "Collections Agent" },
        ],
      },
      {
        id: "inv-personal-2",
        invoiceNo: "ROYALTY-PATREON-OCT",
        customerName: "Digital Content Royalty (YouTube/Patreon)",
        issueDate: "2026-10-01",
        dueDate: "2026-10-25",
        amount: 14200,
        status: "UPCOMING",
        delayDays: 0,
        habit: "EXCELLENT",
        habitDescription: "Platform payout scheduled automatically on the 25th",
        channel: "Creator Payout Rail",
        notes: "Monthly subscriber support & advertising monetization.",
        auditTrail: [
          { timestamp: "2026-10-01 00:00", action: "Creator earnings statement verified", actor: "Patreon Connect" },
        ],
      },
    ],
  },
};

export default function CollectionsHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("kbank");
  const [isBankConnected, setIsBankConnected] = useState<boolean>(true);

  // Tab filter
  const [activeTab, setActiveTab] = useState<"OVERDUE" | "UPCOMING" | "PAID">("OVERDUE");

  // Selected invoice for reminder interface
  const [selectedInvoice, setSelectedInvoice] = useState<ReceivableInvoice | null>(null);

  // Reminder generator state
  const [tone, setTone] = useState<"FRIENDLY" | "FIRM">("FRIENDLY");
  const [channel, setChannel] = useState<"LINE" | "EMAIL">("LINE");
  const [langView, setLangView] = useState<"DUAL" | "TH" | "EN">("DUAL");
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchSuccessToast, setDispatchSuccessToast] = useState<string | null>(null);
  const [paidToast, setPaidToast] = useState<string | null>(null);

  // Active bank configuration
  const currentConfig = BANK_COLLECTIONS_DATA[selectedBankId] || BANK_COLLECTIONS_DATA.kbank;

  // Track dynamic list of invoices in state so "Mark as Paid" updates locally
  const [invoiceList, setInvoiceList] = useState<ReceivableInvoice[]>(currentConfig.invoices);

  // Synchronize bank state
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);

    const checkBankState = () => {
      if (typeof window !== "undefined") {
        const storedBankState = localStorage.getItem("bizmate_bank_connected");
        const storedBank = localStorage.getItem("bizmate_selected_bank") || "kbank";

        const isConnected = storedBankState === "true" && Boolean(storedBank);
        setIsBankConnected(isConnected);

        const validKey = BANK_COLLECTIONS_DATA[storedBank] ? storedBank : "kbank";
        setSelectedBankId(validKey);
      }
    };

    checkBankState();
    window.addEventListener("storage", checkBankState);
    const interval = setInterval(checkBankState, 1000);
    return () => {
      window.removeEventListener("storage", checkBankState);
      clearInterval(interval);
    };
  }, [router]);

  // Update invoice list when bank changes
  useEffect(() => {
    const nextConfig = BANK_COLLECTIONS_DATA[selectedBankId] || BANK_COLLECTIONS_DATA.kbank;
    setInvoiceList(nextConfig.invoices);
    // Select the first overdue invoice by default
    const firstOverdue = nextConfig.invoices.find((inv) => inv.status === "OVERDUE");
    setSelectedInvoice(firstOverdue || nextConfig.invoices[0] || null);
  }, [selectedBankId]);

  const handleSwitchBank = (bankKey: string) => {
    setSelectedBankId(bankKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_selected_bank", bankKey);
    }
  };

  // Filtered invoices
  const filteredInvoices = invoiceList.filter((inv) => inv.status === activeTab);

  // Metrics
  const totalOwed = invoiceList
    .filter((inv) => inv.status === "OVERDUE" || inv.status === "UPCOMING")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalOverdue = invoiceList
    .filter((inv) => inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const overdueInvoices = invoiceList.filter((inv) => inv.status === "OVERDUE");
  const avgDaysDelinquent =
    overdueInvoices.length > 0
      ? Math.round(overdueInvoices.reduce((sum, inv) => sum + inv.delayDays, 0) / overdueInvoices.length)
      : 0;

  // Reminder message templates generated dynamically per invoice & customer
  const getReminderContent = (inv: ReceivableInvoice, selectedTone: "FRIENDLY" | "FIRM") => {
    if (selectedTone === "FRIENDLY") {
      return {
        thai: `สวัสดีครับ ขออนุญาตเรียนแจ้งสถานะใบแจ้งหนี้ #${inv.invoiceNo} ยอด ฿${inv.amount.toLocaleString()} ซึ่งครบกำหนดเมื่อ ${inv.dueDate} ที่ผ่านมาครับ หากท่านดำเนินการโอนเรียบร้อยแล้วสามารถแจ้งสลิปได้เลยนะครับ ขอบพระคุณที่ไว้วางใจร่วมงานกับ ${currentConfig.companyName} เสมอมาครับ 🙏`,
        english: `Hello! Just a courteous follow-up regarding Invoice #${inv.invoiceNo} for ฿${inv.amount.toLocaleString()}, which was due on ${inv.dueDate}. If the settlement has already been processed, please share the payment confirmation with us. Thank you for your continued partnership with ${currentConfig.companyName}!`,
      };
    }
    return {
      thai: `เรียนแจ้งเตือนการชำระเงินตามกำหนด: ใบแจ้งหนี้ #${inv.invoiceNo} ยอดรวม ฿${inv.amount.toLocaleString()} เกินกำหนดชำระแล้ว ${inv.delayDays} วัน (ครบกำหนด ${inv.dueDate}) เพื่อรักษาสิทธิประโยชน์และวงเงินทางการค้า กรุณาดำเนินการชำระหรือประสานงานแผนกบัญชีของ ${currentConfig.companyName} โดยด่วนครับ`,
      english: `Urgent Payment Notice: Invoice #${inv.invoiceNo} in the amount of ฿${inv.amount.toLocaleString()} is currently ${inv.delayDays} days overdue (original due date: ${inv.dueDate}). To maintain your verified credit standing and uninterrupted commercial supply, please arrange settlement or contact ${currentConfig.companyName} immediately.`,
    };
  };

  // Mark invoice as paid
  const handleMarkAsPaid = (invId: string) => {
    setInvoiceList((prev) =>
      prev.map((inv) => {
        if (inv.id === invId) {
          return {
            ...inv,
            status: "PAID",
            settledDate: new Date().toISOString().split("T")[0],
            auditTrail: [
              ...inv.auditTrail,
              {
                timestamp: new Date().toISOString().replace("T", " ").slice(0, 16),
                action: `Marked as paid by business owner (฿${inv.amount.toLocaleString()})`,
                actor: "Owner Action",
              },
            ],
          };
        }
        return inv;
      })
    );
    setPaidToast(`Invoice marked as settled! Forecast updated and alerts cleared.`);
    setTimeout(() => setPaidToast(null), 4000);
  };

  // Execute reminder dispatch
  const handleConfirmDispatch = () => {
    if (!selectedInvoice) return;
    setIsDispatchModalOpen(false);
    setDispatchSuccessToast(
      `Reminder successfully dispatched to ${selectedInvoice.customerName} via ${channel}! Non-destructive record logged in audit ledger.`
    );
    setTimeout(() => setDispatchSuccessToast(null), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16 transition-colors">
      <AppHeader user={user} activeNav="dashboard" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Top Breadcrumb & Linked Account Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-orange-600 dark:text-orange-400 font-bold">
              Collections &amp; Accounts Receivable Hub
            </span>
          </div>

          {/* Connected Bank Switcher */}
          {isBankConnected && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
                Linked Account:
              </span>
              <select
                value={selectedBankId}
                onChange={(e) => handleSwitchBank(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer shadow-xs"
              >
                <option value="kbank">KBANK: Ploy Select Operating</option>
                <option value="scb">SCB: Apex Craft Furniture</option>
                <option value="bbl">BBL: BioHarvest Agro Tech</option>
                <option value="personal">Personal Savings: Freelance Creator</option>
              </select>
            </div>
          )}
        </div>

        {/* LOCKED STATE WHEN BANK IS NOT LINKED */}
        {!isBankConnected ? (
          <div className="rounded-3xl p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center max-w-2xl mx-auto my-12 animate-fade-in-up">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900/60 text-orange-600 dark:text-orange-400 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              🔒
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 inline-block mb-3">
              Bank Connection Required
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Collections &amp; AR Ledger Locked
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-md mx-auto">
              To track accounts receivable, profile customer payment habits, and dispatch polite automated reminders, please connect or select an operating bank account first.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>← Back to Dashboard to Connect Bank</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Notification Toasts */}
            {dispatchSuccessToast && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>✅</span>
                  <span>{dispatchSuccessToast}</span>
                </div>
                <button
                  onClick={() => setDispatchSuccessToast(null)}
                  className="text-emerald-600 dark:text-emerald-400 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {paidToast && (
              <div className="mb-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-semibold flex items-center justify-between animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span>🎉</span>
                  <span>{paidToast}</span>
                </div>
                <button
                  onClick={() => setPaidToast(null)}
                  className="text-blue-600 dark:text-blue-400 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Hero Header Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/80 border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xl font-bold">
                      🔔
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Accounts Receivable &amp; Recovery Hub
                      </h1>
                      <p className="text-xs text-slate-500 font-mono">
                        Automated Debtor Profiling, Courtesy Follow-ups &amp; Liquidity Inflow
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                    Operating for <strong>{currentConfig.companyName}</strong>. The Collections Agent audits counterparty settlement habits from live statement transactions, profiles overdue days, and drafts tone-adjusted multi-lingual reminders to recover liquidity without external debt.
                  </p>
                </div>

                {/* Live Telemetry Pill */}
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shrink-0">
                  <div className="text-center px-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Pending Invoices</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5">
                      {invoiceList.filter((inv) => inv.status !== "PAID").length} Active
                    </span>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                  <div className="text-center px-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Overdue Recoverable</span>
                    <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 mt-0.5 block">
                      ฿{totalOverdue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Outstanding AR</span>
                <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  ฿{totalOwed.toLocaleString()}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Sum of all overdue and upcoming receivables
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Overdue Balance</span>
                <p className="text-2xl font-black font-mono text-orange-600 dark:text-orange-400 mt-1">
                  ฿{totalOverdue.toLocaleString()}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {overdueInvoices.length} invoice(s) past agreed payment terms
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Average Delay Track</span>
                <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {avgDaysDelinquent} Days
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Historical pattern across trade debtors
                </span>
              </div>
            </div>

            {/* Main Interactive Workspace: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN: AR Ledger & Filter Tabs (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Customer Accounts Receivable Ledger
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Historical payment habits and active invoices
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => setActiveTab("OVERDUE")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTab === "OVERDUE"
                            ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        Overdue ({invoiceList.filter((i) => i.status === "OVERDUE").length})
                      </button>
                      <button
                        onClick={() => setActiveTab("UPCOMING")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTab === "UPCOMING"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        Upcoming ({invoiceList.filter((i) => i.status === "UPCOMING").length})
                      </button>
                      <button
                        onClick={() => setActiveTab("PAID")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTab === "PAID"
                            ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        Settled ({invoiceList.filter((i) => i.status === "PAID").length})
                      </button>
                    </div>
                  </div>

                  {/* Invoice List Table */}
                  <div className="mt-4 space-y-3">
                    {filteredInvoices.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <span className="text-2xl block mb-2">🎉</span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          No invoices found in this view
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          All receivables in this category are fully up to date.
                        </p>
                      </div>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const isSelected = selectedInvoice?.id === inv.id;
                        return (
                          <div
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSelected
                                ? "border-orange-500 bg-orange-50/30 dark:bg-orange-950/20 shadow-xs ring-1 ring-orange-400/40"
                                : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-850/50"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                  #{inv.invoiceNo}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                    inv.status === "OVERDUE"
                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                      : inv.status === "UPCOMING"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {inv.status === "OVERDUE"
                                    ? `● ${inv.delayDays} Days Overdue`
                                    : inv.status === "UPCOMING"
                                    ? `Due in ${inv.dueDate}`
                                    : `Paid on ${inv.settledDate}`}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {inv.customerName}
                              </h4>
                              {/* Habit Profiling Pill */}
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                                <span>{inv.habit === "EXCELLENT" ? "🌟" : "⏳"}</span>
                                <span className="truncate max-w-xs">{inv.habitDescription}</span>
                              </div>
                            </div>

                            <div className="sm:text-right shrink-0">
                              <span className="text-sm font-black font-mono text-slate-900 dark:text-white block">
                                ฿{inv.amount.toLocaleString()}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                {inv.channel}
                              </span>
                              {inv.status === "OVERDUE" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInvoice(inv);
                                  }}
                                  className="mt-1.5 text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>Review Draft</span>
                                  <span>→</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Invoice Audit Trail & Tone-Adjusted Reminder Generator (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                {selectedInvoice ? (
                  <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 block">
                          Selected Invoice
                        </span>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          #{selectedInvoice.invoiceNo} • {selectedInvoice.customerName}
                        </h3>
                      </div>
                      <span className="text-sm font-mono font-black text-orange-600 dark:text-orange-400">
                        ฿{selectedInvoice.amount.toLocaleString()}
                      </span>
                    </div>

                    {/* Detailed Invoice Audit Trail */}
                    <div>
                      <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block mb-2">
                        Audit Trail History
                      </span>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {selectedInvoice.auditTrail.map((trail, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono"
                          >
                            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                              <span>{trail.timestamp}</span>
                              <span className="font-bold text-slate-600 dark:text-slate-300">
                                {trail.actor}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 leading-snug">
                              {trail.action}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reminder Generator Controls */}
                    {selectedInvoice.status === "OVERDUE" && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Reminder Dispatch Controls
                          </span>
                          <span className="text-[10px] font-mono text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-900">
                            AI-Assisted Tone
                          </span>
                        </div>

                        {/* Tone Selector: Friendly vs Firm */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                            Reminder Tone Style:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setTone("FRIENDLY")}
                              className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                tone === "FRIENDLY"
                                  ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              🤝 Friendly Partnership
                            </button>
                            <button
                              type="button"
                              onClick={() => setTone("FIRM")}
                              className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                tone === "FIRM"
                                  ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              ⚡ Firm Commercial Notice
                            </button>
                          </div>
                        </div>

                        {/* Channel Routing: LINE vs Email */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                            Delivery Channel:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setChannel("LINE")}
                              className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                                channel === "LINE"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <span>💬</span>
                              <span>LINE Official Account</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setChannel("EMAIL")}
                              className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                                channel === "EMAIL"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <span>✉️</span>
                              <span>Direct Accounting Email</span>
                            </button>
                          </div>
                        </div>

                        {/* Dual Language Toggle */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              Generated Reminder Preview:
                            </label>
                            <div className="flex items-center gap-1 text-[10px] font-mono">
                              <button
                                onClick={() => setLangView("DUAL")}
                                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                  langView === "DUAL" ? "bg-orange-600 text-white font-bold" : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                Dual
                              </button>
                              <button
                                onClick={() => setLangView("TH")}
                                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                  langView === "TH" ? "bg-orange-600 text-white font-bold" : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                ภาษาไทย
                              </button>
                              <button
                                onClick={() => setLangView("EN")}
                                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                  langView === "EN" ? "bg-orange-600 text-white font-bold" : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                English
                              </button>
                            </div>
                          </div>

                          {/* Message Bubble Box */}
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs leading-relaxed">
                            {(langView === "DUAL" || langView === "TH") && (
                              <div>
                                <span className="text-[10px] font-mono uppercase font-bold text-orange-600 dark:text-orange-400 block mb-0.5">
                                  ภาษาไทย (Primary):
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 font-sans">
                                  {getReminderContent(selectedInvoice, tone).thai}
                                </p>
                              </div>
                            )}

                            {(langView === "DUAL" || langView === "EN") && (
                              <div className={langView === "DUAL" ? "pt-2 border-t border-slate-200 dark:border-slate-700" : ""}>
                                <span className="text-[10px] font-mono uppercase font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                                  English Translation:
                                </span>
                                <p className="text-slate-600 dark:text-slate-400 font-sans text-[11px]">
                                  {getReminderContent(selectedInvoice, tone).english}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsDispatchModalOpen(true)}
                            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span>🚀</span>
                            <span>Review &amp; Send Reminder</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                            className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>✓</span>
                            <span>Mark as Paid</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedInvoice.status === "PAID" && (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs">
                        <span className="font-bold flex items-center gap-1.5 mb-1">
                          <span>✓</span>
                          <span>Settlement Verified</span>
                        </span>
                        <p className="leading-relaxed text-[11px]">
                          This invoice was marked settled. AR has been cleared from liquidity alerts and reflected in cash balance metrics.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
                    <span className="text-3xl block mb-2">📋</span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Select an Invoice to Inspect
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose any overdue or upcoming item from the ledger to generate follow-up messages or mark as paid.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* CONFIRMATION BOTTOM SHEET / MODAL ON DISPATCH */}
      {isDispatchModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 flex items-center justify-center text-xl shrink-0">
                🔔
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Reminder Dispatch
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Messages cannot be unsent once routed
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Reference:</span>
                <span className="font-bold text-orange-600">#{selectedInvoice.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Due:</span>
                <span className="font-bold text-slate-900 dark:text-white">฿{selectedInvoice.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Channel:</span>
                <span className="font-bold text-emerald-600">{channel === "LINE" ? "LINE Official Account" : "Direct Accounting Email"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tone Selected:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{tone === "FRIENDLY" ? "Friendly Partnership" : "Firm Commercial Notice"}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              In accordance with Zero-Surprise policy, this message will be dispatched directly to {selectedInvoice.customerName} and logged in the immutable Trust Agent audit trail.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Dispatch via {channel} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
