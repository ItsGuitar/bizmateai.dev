"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { SUPPLIER_AGENTS, SupplierAgentId } from "@/app/data/supplier-agents";
import { AgentIcon } from "@/app/components/icons/AgentIcons";

type ApprovalStatus = "PENDING" | "APPROVED" | "DECLINED";

interface InboxApproval {
  id: string;
  agentId: string;
  title: string;
  description: string;
  impact: string;
  status: ApprovalStatus;
  requiresFaceId: boolean;
  createdAt: string;
}

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  PENDING: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300",
  APPROVED: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300",
  DECLINED: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300",
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "Needs your OK",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function InboxCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-pulse">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800 mb-2" />
      <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/70" />
    </div>
  );
}

export default function InboxPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const [approvals, setApprovals] = useState<InboxApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadInbox = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load inbox");
      setApprovals(data.approvals || []);
    } catch (err: any) {
      console.error("Inbox load failed:", err);
      setLoadError(err.message || "Could not load your inbox. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
    loadInbox();
  }, [router]);

  const handleDecision = async (id: string, status: "APPROVED" | "DECLINED") => {
    setPendingActionId(id);
    try {
      const res = await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to update approval");
      setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      setToastMessage(status === "APPROVED" ? "Approved. The agent will carry this out." : "Declined. Nothing will be sent.");
    } catch (err: any) {
      console.error("Inbox decision failed:", err);
      setToastMessage(err.message || "Could not save your decision. Try again.");
    } finally {
      setPendingActionId(null);
    }
  };

  if (isChecking) {
    return null;
  }

  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="animate-fade-in-up">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Inbox
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Every agent action waits here for your approval. Nothing is sent or changed until you decide.
          </p>
        </div>

        <div
          data-tour="inbox-list"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 animate-fade-in-up delay-100"
        >
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Approval Center</h2>
            <span className="text-xs font-mono uppercase text-slate-400">
              {pendingCount} pending
            </span>
          </div>

          <div className="space-y-2.5">
            {isLoading ? (
              <>
                <InboxCardSkeleton />
                <InboxCardSkeleton />
                <InboxCardSkeleton />
              </>
            ) : loadError ? (
              <div className="p-6 text-center">
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-3">{loadError}</p>
                <button
                  type="button"
                  onClick={loadInbox}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : approvals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">All caught up</p>
                <p className="text-xs text-slate-400 mt-1">
                  When an agent wants to take action on your behalf, it will show up here first.
                </p>
              </div>
            ) : (
              approvals.map((item) => {
                const agent = SUPPLIER_AGENTS[item.agentId as SupplierAgentId] || SUPPLIER_AGENTS.lead;
                const isPending = item.status === "PENDING";
                const isActing = pendingActionId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${agent.color}18`, color: agent.color }}
                      >
                        <AgentIcon id={agent.iconId} className="w-3 h-3" />
                        <span>{agent.name}</span>
                      </span>
                      <span
                        className={`text-[11px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${STATUS_BADGE[item.status]}`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                      {item.requiresFaceId && (
                        <span className="text-[11px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          🔒 Face ID
                        </span>
                      )}
                      <span className="ml-auto text-[11px] font-mono text-slate-400">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.description}
                    </p>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                      {item.impact}
                    </p>

                    {isPending && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleDecision(item.id, "APPROVED")}
                          className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {isActing ? "Saving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleDecision(item.id, "DECLINED")}
                          className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
