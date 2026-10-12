"use client";

import React, { useState } from "react";
import { AGENTS, DEMO_PROFILE, AgentDefinition } from "./data/agents";

export default function WelcomePage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Banner / System Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-lg tracking-wider">
            BM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-sky-300">
                BizMate
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                AI Copilot
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Autonomous Financial Department for Cross-Border MSMEs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mb-10">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 leading-tight">
            Meet your six <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">money mates</span>.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Your dedicated financial department operating under strict glass-box explainability and server-enforced safety rules. No surprise payments, ever.
          </p>
        </div>

        {/* Demo Context Pill */}
        <div className="w-full max-w-4xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 mb-10 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-base">🏢</span>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {DEMO_PROFILE.companyName}
                </span>
                <span className="text-slate-400 mx-2">•</span>
                <span className="text-slate-500 dark:text-slate-400">{DEMO_PROFILE.businessModel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {DEMO_PROFILE.channels.map((ch) => (
                <span
                  key={ch}
                  className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium"
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <strong className="text-amber-600 dark:text-amber-400">
                Active Demo Conflict:
              </strong>{" "}
              {DEMO_PROFILE.coreIssue}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              System Clock: {DEMO_PROFILE.referenceDate}
            </div>
          </div>
        </div>

        {/* 6 Autonomous Agents Grid */}
        <div className="w-full max-w-5xl mb-12">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>🤖</span>
              <span>The 6 Autonomous Financial Agents</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click any agent card to inspect boundaries
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`group relative text-left p-5 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md ${
                    isSelected
                      ? `ring-2 ring-offset-2 dark:ring-offset-slate-950 ${agent.borderColor}`
                      : "border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                  style={{
                    borderTop: `4px solid ${agent.color}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-xs transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${agent.color}18` }}
                      >
                        {agent.emoji}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {agent.name}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {agent.role}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 line-clamp-2 leading-relaxed">
                    {agent.scope}
                  </p>

                  {/* Autonomy vs Consent tags */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                    <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        Does on its own:
                      </span>
                      <span className="truncate">{agent.autonomyLevel}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        Asks you first:
                      </span>
                      <span className="truncate">{agent.consentTrigger}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent Deep-Dive Modal */}
        {selectedAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-2xl relative">
              <button
                onClick={() => setSelectedAgent(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner"
                  style={{ backgroundColor: `${selectedAgent.color}20` }}
                >
                  {selectedAgent.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedAgent.name}
                    </h3>
                    <span
                      className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: selectedAgent.color }}
                    >
                      {selectedAgent.id}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedAgent.role}
                  </p>
                </div>
              </div>

              {/* Standard Header Component Spec demonstration */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-5 border border-slate-200/80 dark:border-slate-700/60">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Agent Mission Statement
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 text-sm italic text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                  <span className="text-lg">💬</span>
                  <span>
                    &quot;{selectedAgent.description}&quot;
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 mb-6 text-sm">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Does on its own (Autonomy Scope)</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {selectedAgent.autonomyLevel}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                  <div className="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <span>✋</span>
                    <span>Consent Trigger (Asks you first via Inbox / Face ID)</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {selectedAgent.consentTrigger}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span>Data Lineage: Connected bank feeds & marketplace APIs</span>
                <span className="font-mono">Checked by Trust Agent</span>
              </div>
            </div>
          </div>
        )}

        {/* Core Architecture Axioms (Glass Box / Zero-Surprise) */}
        <div className="w-full max-w-5xl bg-slate-900 text-white rounded-3xl p-6 sm:p-8 mb-12 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
              <span>🛡️</span>
              <span>Server-Enforced Trust</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-4">
              Built on 4 Core Architecture Axioms
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <div className="text-blue-400 font-bold text-sm mb-1">1. Glass Box AI</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Full reasoning shown before any action. No black-box automated mistakes.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <div className="text-emerald-400 font-bold text-sm mb-1">2. Zero-Surprise Policy</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  No communication sent and no payment made without owner approval or Face ID.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <div className="text-sky-400 font-bold text-sm mb-1">3. Server Guardrails</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Safety is enforced by deterministic backend rules, never left to prompts alone.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <div className="text-amber-400 font-bold text-sm mb-1">4. Chat Explains, Screens Act</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Conversations guide decisions; actionable workflows transition directly to native views.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Call to Action Section */}
        <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">
          <button
            onClick={() => {
              alert("Navigating to ON-02 (Bank Linkage Step 1 of 3) with Read-Only Consent...");
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base sm:text-lg shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Get started</span>
            <span className="text-xl">→</span>
          </button>

          <button
            onClick={() => {
              alert("Fast-tracking directly to Home Dashboard (HM-01)...");
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            I already have an account
          </button>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="w-full border-t border-slate-200/80 dark:border-slate-800 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            BizMate MSME Financial Copilot
          </div>
          <div className="flex items-center gap-4">
            <span>PDPA Compliant</span>
            <span>•</span>
            <span>Biometric Face ID Step-Up</span>
            <span>•</span>
            <span>Bank-Grade Encryption</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
