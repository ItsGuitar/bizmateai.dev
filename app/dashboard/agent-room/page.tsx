"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { AgentRoomView } from "@/app/components/AgentRoomView";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { ORDER_PLAN_RUN } from "@/app/data/supplier-copilot-mock";

const EVENT_DELAY_MS = 2200;

export default function AgentRoomPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [revealCount, setRevealCount] = useState(0);
  const [isThinking, setIsThinking] = useState(true);
  const [approvalDecisions, setApprovalDecisions] = useState<Record<string, "approved" | "declined">>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
  }, [router]);

  const totalEvents = ORDER_PLAN_RUN.events.length;
  const isDone = revealCount >= totalEvents;

  useEffect(() => {
    if (isChecking || isDone) {
      setIsThinking(false);
      return;
    }

    setIsThinking(true);
    timerRef.current = setTimeout(() => {
      setRevealCount((prev) => Math.min(prev + 1, totalEvents));
    }, EVENT_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revealCount, isChecking, isDone, totalEvents]);

  const handleSkipToResult = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevealCount(totalEvents);
    setIsThinking(false);
  };

  const handleApprove = (id: string) => {
    setApprovalDecisions((prev) => ({ ...prev, [id]: "approved" }));
    setToastMessage("Approved. Policy Guard logged it to the audit trail.");
  };

  const handleDecline = (id: string) => {
    setApprovalDecisions((prev) => ({ ...prev, [id]: "declined" }));
    setToastMessage("Declined. Nothing was sent.");
  };

  if (isChecking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <div className="animate-fade-in-up flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-1 cursor-pointer inline-flex items-center gap-1"
            >
              <span>←</span>
              <span>Back to Home</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Agent room
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Watch the agents work through a plan, live. Every step, every number, nothing hidden.
            </p>
          </div>
          <span
            className={`shrink-0 text-xs font-mono font-bold uppercase px-2.5 py-1 rounded-full border ${
              isDone
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
                : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300"
            }`}
          >
            {isDone ? "Done" : "● Live"}
          </span>
        </div>

        <AgentRoomView
          title={ORDER_PLAN_RUN.title}
          steps={ORDER_PLAN_RUN.steps}
          events={ORDER_PLAN_RUN.events}
          approvals={ORDER_PLAN_RUN.approvals}
          revealCount={revealCount}
          isThinking={isThinking}
          isDone={isDone}
          onSkipToResult={handleSkipToResult}
          approvalDecisions={approvalDecisions}
          onApprove={handleApprove}
          onDecline={handleDecline}
        />
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
