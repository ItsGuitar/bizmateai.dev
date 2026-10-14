"use client";

import React, { useState, useEffect } from "react";
import { getSession } from "@/lib/auth-client";

export interface BankOption {
  id: string;
  name: string;
  code: string;
  desc: string;
  logoUrl: string;
  badge?: string;
}

export const AVAILABLE_BANKS: BankOption[] = [
  {
    id: "kbank",
    name: "Kasikornbank (Partner Bank)",
    code: "KBANK",
    desc: "Ploy Select Co., Ltd. • 12-Month SME Account",
    logoUrl: "/logos/KBANK.png",
    badge: "Recommended Partner",
  },
  {
    id: "scb",
    name: "Siam Commercial Bank",
    code: "SCB",
    desc: "Apex Craft Furniture • 12-Month B2B Export Gateway",
    logoUrl: "/logos/SCB.png",
  },
  {
    id: "bbl",
    name: "Bangkok Bank",
    code: "BBL",
    desc: "BioHarvest Agro Tech • 12-Month Agri-Tech Gateway",
    logoUrl: "/logos/BBL.png",
  },
  {
    id: "personal",
    name: "Personal / Freelancer Account",
    code: "INDIVIDUAL",
    desc: "Kittisak Somchai • 3-Month Individual Cash Flow",
    logoUrl: "/logos/PromptPay.png",
    badge: "Individual / 3M",
  },
];

export interface BankConnection {
  id: string;
  bankId: string;
  bankName: string;
  companyName: string;
  isEnabled: boolean;
  linkedAt: string;
}

interface BankSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export function BankSettingsModal({ isOpen, onClose, onSettingsChanged }: BankSettingsModalProps) {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Bank Consent Stepper
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNewBankId, setSelectedNewBankId] = useState<string>("kbank");
  const [showConsentSheet, setShowConsentSheet] = useState(false);
  const [isLinkingBank, setIsLinkingBank] = useState(false);

  // Fetch current user bank connections
  const fetchConnections = async () => {
    const session = getSession();
    if (!session?.token) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/financial/link-bank", {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (data.connections) {
        setConnections(data.connections);

        // Update local storage active bank list for fast instant client hydration
        const enabledIds = data.connections.filter((c: BankConnection) => c.isEnabled).map((c: BankConnection) => c.bankId);
        if (typeof window !== "undefined") {
          localStorage.setItem("bizmate_enabled_banks", JSON.stringify(enabledIds));
          if (enabledIds.length > 0) {
            localStorage.setItem("bizmate_bank_connected", "true");
          }
        }
      }
    } catch (err) {
      console.error("Failed to load bank connections:", err);
      setErrorMessage("Unable to retrieve connected bank accounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConnections();
    }
  }, [isOpen]);

  // Toggle individual bank
  const handleToggleBank = async (bankId: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    // Client-side guard: at least 1 must remain enabled
    const currentActiveCount = connections.filter((c) => c.isEnabled).length;
    if (!nextEnabled && currentActiveCount <= 1) {
      setErrorMessage("At least one bank account must remain active (cannot disable all banks).");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const session = getSession();
    if (!session?.token) return;

    setErrorMessage(null);
    try {
      const res = await fetch("/api/financial/link-bank", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ bankId, isEnabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to update bank status");
        setTimeout(() => setErrorMessage(null), 4000);
        return;
      }

      if (data.connections) {
        setConnections(data.connections);
        const enabledIds = data.connections.filter((c: BankConnection) => c.isEnabled).map((c: BankConnection) => c.bankId);
        if (typeof window !== "undefined") {
          localStorage.setItem("bizmate_enabled_banks", JSON.stringify(enabledIds));
          window.dispatchEvent(new Event("bizmate_bank_changed"));
        }
        setSuccessToast(nextEnabled ? "Bank account enabled successfully" : "Bank account paused from aggregation");
        setTimeout(() => setSuccessToast(null), 3000);
        if (onSettingsChanged) onSettingsChanged();
      }
    } catch {
      setErrorMessage("Network error updating bank status");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // Open All banks
  const handleOpenAll = async () => {
    const session = getSession();
    if (!session?.token) return;

    setErrorMessage(null);
    try {
      const res = await fetch("/api/financial/link-bank", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ action: "OPEN_ALL" }),
      });
      const data = await res.json();
      if (data.connections) {
        setConnections(data.connections);
        const enabledIds = data.connections.map((c: BankConnection) => c.bankId);
        if (typeof window !== "undefined") {
          localStorage.setItem("bizmate_enabled_banks", JSON.stringify(enabledIds));
          window.dispatchEvent(new Event("bizmate_bank_changed"));
        }
        setSuccessToast("All linked banks enabled (Open All)");
        setTimeout(() => setSuccessToast(null), 3000);
        if (onSettingsChanged) onSettingsChanged();
      }
    } catch {
      setErrorMessage("Failed to enable all banks");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // Confirm Linking a new Bank (Step 1 + Consent Form)
  const handleConfirmAddBank = async () => {
    setIsLinkingBank(true);
    const session = getSession();
    if (!session?.token) return;

    try {
      // 1. Audit trail log
      await fetch("/api/trust/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          agentId: "trust",
          action: `New bank linked: ${AVAILABLE_BANKS.find((b) => b.id === selectedNewBankId)?.name} (Read-Only 12-month scope)`,
          status: "DONE",
        }),
      }).catch(() => {});

      // 2. Add connection
      const res = await fetch("/api/financial/link-bank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ bankId: selectedNewBankId }),
      });

      const data = await res.json();
      if (res.ok) {
        await fetchConnections();
        setIsLinkingBank(false);
        setShowConsentSheet(false);
        setShowAddModal(false);
        setSuccessToast("New bank account linked successfully 👍");
        setTimeout(() => setSuccessToast(null), 3000);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("bizmate_bank_changed"));
        }
        if (onSettingsChanged) onSettingsChanged();
      } else {
        setErrorMessage(data.error || "Failed to link bank");
        setIsLinkingBank(false);
      }
    } catch {
      setErrorMessage("Network error linking bank");
      setIsLinkingBank(false);
    }
  };

  if (!isOpen) return null;

  // Unlinked available banks that can be added
  const existingBankIds = connections.map((c) => c.bankId);
  const unlinkedBanks = AVAILABLE_BANKS.filter((b) => !existingBankIds.includes(b.id));
  const activeCount = connections.filter((c) => c.isEnabled).length;
  const targetBankToAdd = AVAILABLE_BANKS.find((b) => b.id === selectedNewBankId) || AVAILABLE_BANKS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative my-auto flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-xl shrink-0">
              🏦
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Bank Connections &amp; Accounts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage accounts &amp; Multi-Bank Liquidity Aggregation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successToast && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <span>✓</span>
            <span>{successToast}</span>
          </div>
        )}

        {/* Summary Info Banner */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Active in Sum:
            </span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              {activeCount} / {connections.length} Accounts
            </span>
          </div>
          {connections.length > 1 && (
            <button
              onClick={handleOpenAll}
              disabled={activeCount === connections.length}
              className={`font-bold text-xs px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                activeCount === connections.length
                  ? "text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
              }`}
            >
              Open All
            </button>
          )}
        </div>

        {/* Bank Connection List */}
        <div className="mt-4 overflow-y-auto flex-1 space-y-2.5 pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading bank accounts...</span>
            </div>
          ) : connections.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              <span>No bank accounts linked yet. Click &quot;+ Link New Bank&quot; below.</span>
            </div>
          ) : (
            connections.map((conn) => {
              const bankMeta = AVAILABLE_BANKS.find((b) => b.id === conn.bankId) || {
                logoUrl: "/logos/PromptPay.png",
                badge: undefined,
              };

              return (
                <div
                  key={conn.id}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                    conn.isEnabled
                      ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs"
                      : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xs border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bankMeta.logoUrl}
                        alt={conn.bankName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {conn.bankName}
                        </h4>
                        {conn.isEnabled && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {conn.companyName}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {conn.isEnabled ? "Enabled" : "Paused"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleBank(conn.bankId, conn.isEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        conn.isEnabled
                          ? "bg-blue-600 justify-end"
                          : "bg-slate-300 dark:bg-slate-700 justify-start"
                      }`}
                      aria-label={`Toggle ${conn.bankName}`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer: Add Bank Button */}
        <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {unlinkedBanks.length > 0 ? (
            <button
              onClick={() => {
                setSelectedNewBankId(unlinkedBanks[0].id);
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 rounded-xl border border-blue-600/40 bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Link New Bank</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">All available banks connected</span>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* ========================================================
          SUB-MODAL: Select Unlinked Bank (Like Onboarding)
      ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative my-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Select Bank Account to Connect
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 mb-6 max-h-60 overflow-y-auto">
              {unlinkedBanks.map((bank) => (
                <div
                  key={bank.id}
                  onClick={() => setSelectedNewBankId(bank.id)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedNewBankId === bank.id
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/25"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xs border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bank.logoUrl}
                        alt={bank.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {bank.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {bank.desc}
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="new_bank_choice"
                    checked={selectedNewBankId === bank.id}
                    onChange={() => setSelectedNewBankId(bank.id)}
                    className="w-4 h-4 text-blue-600 cursor-pointer"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConsentSheet(true);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Review Read-Only Scope →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-MODAL: Consent Sheet (Exact same clauses as Onboarding)
      ======================================================== */}
      {showConsentSheet && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => !isLinkingBank && setShowConsentSheet(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xs border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={targetBankToAdd.logoUrl}
                    alt={targetBankToAdd.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Explicit Read-Only Scope
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Consent Agreement • {targetBankToAdd.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowConsentSheet(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 4 PRD Mandated Consent Clauses */}
            <div className="space-y-3 my-5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">1.</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Account Balances &amp; History:</strong>
                  Ingests current balances and 12-month past transactions strictly to project Cash Radar.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">2.</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Account Identity:</strong>
                  Verifies registered business name and account numbers against corporate registration.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-rose-600 font-bold">3.</span>
                <div>
                  <strong className="text-rose-600 dark:text-rose-400 block">Strict Negative Scope:</strong>
                  BizMate <em>CANNOT</em> transfer funds, execute debits, or modify any account settings.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-blue-600 font-bold">4.</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Duration &amp; Revocability:</strong>
                  Valid for 12 months under Thailand PDPA. Revocable anytime with 1 tap in the Trust Agent menu.
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isLinkingBank}
                onClick={() => setShowConsentSheet(false)}
                className="w-1/3 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLinkingBank}
                onClick={handleConfirmAddBank}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLinkingBank ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing Trust Grant...</span>
                  </>
                ) : (
                  <span>I Authorize Read-Only Feed →</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
