"use client";

import React, { useState } from "react";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import type { LoggedAiCall } from "@/lib/ai/call-log";

interface SystemStatus {
  aiConnected: boolean;
  configuredModel: string;
  timestamp: string;
  totalLogs: number;
}

export default function AdminTelemetryPage() {
  const [pinInput, setPinInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<LoggedAiCall[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchTelemetry = async (pin: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setIsAuthenticated(true);
        setSystemStatus(data.systemStatus);
        setLogs(data.logs || []);
      } else {
        setErrorMsg(data.error || "Authentication failed. Invalid PIN.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    fetchTelemetry(pinInput.trim());
  };

  const handleRefresh = () => {
    if (pinInput) fetchTelemetry(pinInput);
  };

  const handleClearLogs = async () => {
    if (!pinInput) return;
    try {
      const res = await fetch("/api/admin/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput, action: "clear" }),
      });
      if (res.ok) {
        setLogs([]);
        setToastMessage("Logs cleared successfully.");
      }
    } catch {
      setErrorMsg("Failed to clear logs");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={null} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto mt-16 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="text-center mb-6">
              <span className="text-3xl">🔐</span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                Internal AI Telemetry
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Restricted portal for debugging model calls, latency, and status.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block mb-1">
                  Backend Security PIN
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter 8-digit PIN"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest font-mono text-base"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? "Verifying with server..." : "Verify PIN & Access →"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    AI Diagnostics & Telemetry
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    PIN Authenticated
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Real-time monitor tracking model connectivity, active model tier, and recent inference payloads.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  ↻ Refresh
                </button>
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                >
                  Clear Logs
                </button>
              </div>
            </div>

            {/* Health / Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  AI Connectivity
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      systemStatus?.aiConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                    }`}
                  />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {systemStatus?.aiConnected ? "Connected (API Key Active)" : "Disconnected"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Provider: Google Generative AI
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Configured Model
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono mt-1 block">
                  {systemStatus?.configuredModel || "unknown"}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Multimodal Vision & Fast Reasoning
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Recorded Call History
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-1 block">
                  {logs.length} calls in memory
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Ring buffer capacity: 100 entries
                </span>
              </div>
            </div>

            {/* Logs List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Model Request Stream
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  Detailed prompt masking & raw reply audits
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No model calls recorded yet. Open the Document Scanner in New Order or Data to trigger a vision call.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const isSuccess = log.status === "success";
                    return (
                      <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div
                          className="flex items-center justify-between gap-2 cursor-pointer select-none"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                isSuccess
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              }`}
                            >
                              {log.status}
                            </span>
                            <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                              {log.task}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {log.model}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {log.latencyMs !== undefined && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {log.latencyMs}ms
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-slate-400">
                              {new Date(log.at).toLocaleTimeString()}
                            </span>
                            <span className="text-xs text-slate-400">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>

                        {/* Error message preview if any */}
                        {log.errorMessage && (
                          <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg">
                            {log.errorMessage}
                          </div>
                        )}

                        {/* Expanded Payload view */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-xs">
                            <div>
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                Masked System Prompt
                              </span>
                              <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-48">
                                {log.systemPrompt}
                              </pre>
                            </div>

                            <div>
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                Raw Model Response
                              </span>
                              <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-64">
                                {log.maskedReply}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
