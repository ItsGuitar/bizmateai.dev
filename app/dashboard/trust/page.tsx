"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { SUPPLIER_AGENTS, type SupplierAgentId } from "@/app/data/supplier-agents";
import { TIER_RULES, SELF_ASSESSMENT, MASKING_DEMO, type AuditEntrySeed } from "@/app/data/trust-mock";
import { GENESIS_HASH, computeChain, merkleRootOf } from "@/lib/audit-chain";

interface LiveApproval {
  id: string;
  agentId: string;
  title: string;
  description: string;
  impact: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
}

function agentFor(id: string) {
  return (SUPPLIER_AGENTS as Record<string, (typeof SUPPLIER_AGENTS)[SupplierAgentId]>)[id] ?? null;
}

function shortHash(hash: string | undefined): string {
  if (!hash) return "computing…";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TIER_STYLE: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  1: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  2: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  3: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300",
};

export default function TrustPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [approvals, setApprovals] = useState<LiveApproval[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);

  const [entries, setEntries] = useState<AuditEntrySeed[]>([]);
  const [baselineEntries, setBaselineEntries] = useState<AuditEntrySeed[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [sealedHashes, setSealedHashes] = useState<string[] | null>(null);
  const [currentHashes, setCurrentHashes] = useState<string[] | null>(null);
  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [draftDetail, setDraftDetail] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
  }, [router]);

  // Real approvals (the same InboxApproval rows the Receivables/Financing/Procurement pages
  // write to via /api/inbox) and the real audit trail (/api/audit), not the old mock data.
  useEffect(() => {
    if (isChecking) return;
    (async () => {
      setIsLoadingApprovals(true);
      try {
        const res = await fetch("/api/inbox");
        const data = await res.json();
        if (data.success) setApprovals(data.approvals);
      } catch (err) {
        console.error("Trust approvals load error:", err);
      } finally {
        setIsLoadingApprovals(false);
      }
    })();

    (async () => {
      setIsLoadingAudit(true);
      try {
        const res = await fetch("/api/audit");
        const data = await res.json();
        if (data.success) {
          setEntries(data.entries);
          setBaselineEntries(data.entries);
        }
      } catch (err) {
        console.error("Trust audit load error:", err);
      } finally {
        setIsLoadingAudit(false);
      }
    })();
  }, [isChecking]);

  // Seal the real chain once it loads, so tampering later has a clean baseline to verify against.
  useEffect(() => {
    if (baselineEntries.length === 0) {
      setSealedHashes(null);
      return;
    }
    computeChain(baselineEntries).then(setSealedHashes);
  }, [baselineEntries]);

  // Recompute the live chain whenever an entry is edited, so a tamper test shows its effect immediately.
  useEffect(() => {
    if (entries.length === 0) {
      setCurrentHashes(null);
      return;
    }
    let cancelled = false;
    computeChain(entries).then((hashes) => {
      if (!cancelled) setCurrentHashes(hashes);
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const breakPoint = useMemo(() => {
    if (!sealedHashes || !currentHashes) return null;
    for (let i = 0; i < sealedHashes.length; i++) {
      if (sealedHashes[i] !== currentHashes[i]) return i;
    }
    return null;
  }, [sealedHashes, currentHashes]);

  const isTampered = entries.some((e, i) => e.detail !== baselineEntries[i]?.detail);

  if (isChecking) {
    return null;
  }

  const guard = SUPPLIER_AGENTS.guard;
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  const submitDecision = async (approval: LiveApproval, status: "APPROVED" | "DECLINED") => {
    try {
      const res = await fetch(`/api/inbox/${approval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save");
      setApprovals((prev) => prev.map((a) => (a.id === approval.id ? { ...a, status } : a)));
      setToastMessage(
        status === "APPROVED"
          ? `Approved: ${approval.title}. Logged to the audit trail.`
          : `Declined: ${approval.title}. Nothing was sent.`
      );
    } catch (err: any) {
      setToastMessage(err.message || "Could not save that decision.");
    }
  };

  const handleApprove = (approval: LiveApproval) => submitDecision(approval, "APPROVED");
  const handleDecline = (approval: LiveApproval) => submitDecision(approval, "DECLINED");

  const startTamper = (entry: AuditEntrySeed) => {
    setEditingSeq(entry.seq);
    setDraftDetail(entry.detail);
  };

  const applyTamper = () => {
    if (editingSeq === null) return;
    setEntries((prev) => prev.map((e) => (e.seq === editingSeq ? { ...e, detail: draftDetail } : e)));
    setEditingSeq(null);
    setToastMessage("Entry edited. Check the chain below, it breaks from that point on.");
  };

  const resetTamper = () => {
    setEntries(baselineEntries.map((e) => ({ ...e })));
    setEditingSeq(null);
    setToastMessage("Chain restored.");
  };

  const handleVerify = () => {
    if (breakPoint === null) {
      setToastMessage("Chain verified. Every hash matches, nothing was changed.");
    } else {
      setToastMessage(`Chain broken at entry #${entries[breakPoint].seq}. Everything after it no longer matches.`);
    }
  };

  const handleExport = async () => {
    if (!currentHashes) return;
    setIsExporting(true);
    const merkleRoot = await merkleRootOf(currentHashes);
    const payload = {
      date: "2026-10-17",
      entries: entries.map((e, i) => ({
        ...e,
        prevHash: i === 0 ? GENESIS_HASH : currentHashes[i - 1],
        hash: currentHashes[i],
      })),
      merkleRoot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_log_2026-10-17.json";
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setToastMessage(`Exported. Merkle root ${shortHash(merkleRoot)}.`);
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
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Trust</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            What the AI can do alone, what needs your OK, and proof nothing was changed.
          </p>
        </div>

        {/* Agent bar: Policy Guard is plain code, not a model, and says so */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap relative overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 z-10">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${guard.color}18`, color: guard.color }}
            >
              {guard.emoji}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{guard.name}</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Rules, not AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Every action passes through me first. No model can change my rules.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 z-10">
            <Image
              src="/images/bot06_stand_neutral.png"
              alt=""
              width={64}
              height={64}
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain select-none pointer-events-none drop-shadow-md shrink-0 hidden sm:block"
            />
            <span className="text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 shrink-0">
              {pendingCount} pending approval{pendingCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Permission tiers */}
        <div className="animate-fade-in-up delay-150 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Permission tiers</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Every action falls into one of four levels.</p>

          <div className="space-y-2">
            {TIER_RULES.map((t) => (
              <div
                key={t.tier}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 flex-wrap ${
                  t.tier === 3
                    ? "border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20"
                    : "border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${TIER_STYLE[t.tier]}`}>
                  {t.tier === 3 ? "🔒" : `T${t.tier}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.action} <span className="font-normal text-slate-400">· {t.rule}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.examples.join(" · ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Approvals */}
        <div className="animate-fade-in-up delay-200 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Approvals</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Tier-2 actions wait here until you say yes or no.
          </p>

          {isLoadingApprovals ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
          ) : approvals.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No approvals yet. Actions proposed by the agents (Receivables, Procurement, Financing) will show up here.
            </p>
          ) : (
          <div className="space-y-2.5">
            {approvals.map((approval) => {
              const agent = agentFor(approval.agentId);
              const decision = approval.status === "PENDING" ? null : approval.status === "APPROVED" ? "approved" : "declined";
              return (
                <div key={approval.id} className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: agent ? `${agent.color}18` : "#64748b18", color: agent?.color ?? "#64748b" }}
                    >
                      <span>{agent?.emoji ?? "🤖"}</span>
                      <span>{agent?.name ?? approval.agentId}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                      Tier 2 · needs your OK
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{approval.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{approval.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">{approval.impact}</span>
                    {decision ? (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          decision === "approved"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {decision === "approved" ? "Approved" : "Declined"}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDecline(approval)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(approval)}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Masking demo */}
        <div className="animate-fade-in-up delay-250 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">What the AI sees</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Names and IDs are swapped for tokens before any call. Amounts stay real, the AI needs those to reason.
          </p>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 mb-4 text-xs text-slate-500 dark:text-slate-400">
            Last call: <span className="font-semibold text-slate-700 dark:text-slate-200">{MASKING_DEMO.callLabel}</span> · {MASKING_DEMO.sentAt}
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase text-slate-400 font-bold">
                  <th className="pb-2 pr-4">Field</th>
                  <th className="pb-2 pr-4">You see</th>
                  <th className="pb-2">The AI sees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {MASKING_DEMO.mapping.map((row) => (
                  <tr key={row.field}>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{row.field}</td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-white font-semibold">{row.real}</td>
                    <td className="py-2 font-mono text-blue-600 dark:text-blue-400">{row.token}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide mb-1.5">
            The exact payload sent
          </p>
          <pre className="text-xs font-mono p-3 rounded-2xl bg-slate-900 text-slate-100 overflow-x-auto">
{JSON.stringify(MASKING_DEMO.lastPayload, null, 2)}
          </pre>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            The real names behind each token stay in BizMateAI's own database and are never sent out.
          </p>
        </div>

        {/* Audit log */}
        <div className="animate-fade-in-up delay-300 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Audit log</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVerify}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Verify chain
              </button>
              {isTampered && (
                <button
                  type="button"
                  onClick={resetTamper}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isExporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            Every action is hashed to the one before it. Edit an entry below to see the chain break.
          </p>
          <p className={`text-sm font-semibold mb-4 ${breakPoint === null ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {entries.length === 0
              ? ""
              : !currentHashes
              ? "Computing the chain…"
              : breakPoint === null
              ? "Chain intact, every hash checks out"
              : `Broken from entry #${entries[breakPoint].seq} onward`}
          </p>

          {isLoadingAudit ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No audit entries yet. Every calculation, reminder, and approval will show up here once you use the app.
            </p>
          ) : (
          <div className="space-y-1.5">
            {entries.map((entry, i) => {
              const agent = entry.actor === "owner" ? null : agentFor(entry.actor);
              const hash = currentHashes?.[i];
              const broken = breakPoint !== null && i >= breakPoint;
              return (
                <div key={entry.seq} className={`p-3 rounded-2xl border ${broken ? "border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20" : "border-slate-200/80 dark:border-slate-800"}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">#{entry.seq}</span>
                        {agent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${agent.color}18`, color: agent.color }}>
                            <span>{agent.emoji}</span>
                            <span>{agent.name}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {entry.actor === "owner" ? "👤 You" : entry.actor}
                          </span>
                        )}
                        <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${TIER_STYLE[entry.tier]}`}>
                          T{entry.tier}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{formatTime(entry.ts)}</span>
                      </div>
                      {editingSeq === entry.seq ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            type="text"
                            value={draftDetail}
                            onChange={(e) => setDraftDetail(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                          />
                          <button type="button" onClick={applyTamper} className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer">
                            Save edit
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700 dark:text-slate-200">{entry.detail}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-mono ${broken ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`} title={hash}>
                        {broken ? "✕ " : "✓ "}
                        {shortHash(hash)}
                      </p>
                      {editingSeq !== entry.seq && (
                        <button
                          type="button"
                          onClick={() => startTamper(entry)}
                          className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer mt-1"
                        >
                          Tamper test
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Self-assessment */}
        <div className="animate-fade-in-up delay-350 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Security self-assessment</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Where we stand today, and what's left.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase text-slate-400 font-bold">
                  <th className="pb-2 pr-4">Risk</th>
                  <th className="pb-2 pr-4">Control today</th>
                  <th className="pb-2">Left to do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {SELF_ASSESSMENT.map((row) => (
                  <tr key={row.risk}>
                    <td className="py-2.5 pr-4 font-semibold text-slate-900 dark:text-white align-top">{row.risk}</td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300 align-top">{row.control}</td>
                    <td className="py-2.5 text-slate-400 dark:text-slate-500 align-top">{row.leftToDo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
