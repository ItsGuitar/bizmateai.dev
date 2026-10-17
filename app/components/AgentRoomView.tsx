"use client";

import React, { useState } from "react";
import { SUPPLIER_AGENTS } from "@/app/data/supplier-agents";
import type {
  AgentRoomEvent,
  AgentRoomStep,
  ApprovalCard,
} from "@/app/data/supplier-copilot-mock";

interface AgentRoomViewProps {
  title: string;
  steps: AgentRoomStep[];
  events: AgentRoomEvent[];
  approvals: ApprovalCard[];
  revealCount: number; // how many events are visible so far
  isThinking: boolean; // true while the next event hasn't landed yet
  isDone: boolean;
  onSkipToResult: () => void;
  approvalDecisions: Record<string, "approved" | "declined">;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}

export function AgentRoomView({
  title,
  steps,
  events,
  approvals,
  revealCount,
  isThinking,
  isDone,
  onSkipToResult,
  approvalDecisions,
  onApprove,
  onDecline,
}: AgentRoomViewProps) {
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());

  const toggleReasoning = (id: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleEvents = events.slice(0, revealCount);
  const activeStageIndex = isDone
    ? steps.length - 1
    : Math.min(visibleEvents.length, steps.length - 1);

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</h2>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            {isDone
              ? `Done · ${steps.length} of ${steps.length} steps`
              : `Step ${Math.min(activeStageIndex + 1, steps.length)} of ${steps.length}: ${
                  steps[activeStageIndex]?.label ?? ""
                }`}
          </p>
        </div>
        {!isDone && (
          <button
            type="button"
            onClick={onSkipToResult}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Skip to result
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        {/* Step list */}
        <div className="border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 p-4 space-y-1">
          {steps.map((step, idx) => {
            const status =
              idx < activeStageIndex || isDone
                ? "done"
                : idx === activeStageIndex
                ? "active"
                : "pending";
            return (
              <div key={step.id} className="flex items-center gap-2.5 py-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    status === "done"
                      ? "bg-emerald-500 text-white"
                      : status === "active"
                      ? "bg-blue-600 text-white animate-pulse"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {status === "done" ? "✓" : idx + 1}
                </span>
                <span
                  className={`text-xs leading-tight ${
                    status === "pending"
                      ? "text-slate-400 dark:text-slate-600"
                      : "text-slate-700 dark:text-slate-200 font-medium"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Message stream */}
        <div className="p-4 sm:p-5 space-y-3">
          {visibleEvents.map((event) => {
            const fromAgent = SUPPLIER_AGENTS[event.from];
            const toAgent = SUPPLIER_AGENTS[event.to];
            const isExpanded = expandedReasoning.has(event.id);

            return (
              <div
                key={event.id}
                className={`p-3.5 rounded-2xl border transition-colors animate-fade-in-up ${
                  event.isChallenge
                    ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                    : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${fromAgent.color}18`, color: fromAgent.color }}
                    >
                      <span>{fromAgent.emoji}</span>
                      <span>{fromAgent.name}</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${toAgent.color}18`, color: toAgent.color }}
                    >
                      <span>{toAgent.emoji}</span>
                      <span>{toAgent.name}</span>
                    </span>
                    {event.isChallenge && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-mono uppercase bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                        Challenge
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs italic text-slate-400 dark:text-slate-500 mb-1">
                  {event.statusText}
                </p>

                <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                  {event.text}
                </p>

                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {event.tool && (
                    <span className="text-xs font-mono px-2 py-1 rounded-lg bg-slate-900/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                      {event.tool}
                    </span>
                  )}
                  {event.reasoning && event.reasoning.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleReasoning(event.id)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {isExpanded ? "Hide reasoning" : "Show reasoning"}
                    </button>
                  )}
                </div>

                {isExpanded && event.reasoning && (
                  <ul className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    {event.reasoning.map((line, i) => (
                      <li
                        key={i}
                        className="text-xs font-mono text-slate-500 dark:text-slate-400 flex gap-1.5"
                      >
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {isThinking && !isDone && (
            <div className="flex items-center gap-2 px-3.5 py-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" />
              </span>
              <span>Thinking...</span>
            </div>
          )}

          {/* Approval cards: shown once the run is done */}
          {isDone && (
            <div className="pt-2 space-y-2.5">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                Result · Needs your OK
              </p>
              {approvals.map((approval) => {
                const agent = SUPPLIER_AGENTS[approval.agent];
                const decision = approvalDecisions[approval.id];
                return (
                  <div
                    key={approval.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${agent.color}18`, color: agent.color }}
                      >
                        <span>{agent.emoji}</span>
                        <span>{agent.name}</span>
                      </span>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        Checked by Policy Guard
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{approval.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{approval.detail}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        {approval.impact}
                      </span>
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
                            onClick={() => onDecline(approval.id)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => onApprove(approval.id)}
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
      </div>
    </div>
  );
}
