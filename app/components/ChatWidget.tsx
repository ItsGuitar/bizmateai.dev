"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth-client";

interface ChatMessage {
  id: string;
  senderType: "USER" | "AGENT";
  agentId?: string;
  content: string;
  reasoning?: string;
  actionRoute?: string;
  createdAt: string;
}

const AGENTS_META: Record<string, { name: string; emoji: string; color: string; bg: string }> = {
  cash: { name: "Cash Agent", emoji: "📊", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800" },
  health: { name: "Health Agent", emoji: "🩺", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800" },
  funding: { name: "Funding Agent", emoji: "💰", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800" },
  collections: { name: "Collections Agent", emoji: "🔔", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800" },
  "true-cost": { name: "True Cost Agent", emoji: "🔍", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800" },
  trust: { name: "Trust Agent", emoji: "🛡️", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800" },
};

const SUGGESTED_QUESTIONS = [
  "How is our 13-week cash runway and liquidity buffer looking?",
  "What are our pending accounts receivable from Boutique Siam?",
  "Explain our financial health score and areas to improve.",
  "What is the cheapest way to finance the Chen Tech supplier payment?",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Settings / Custom API Key Modal
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeApiKey, setActiveApiKey] = useState("");
  const [apiKeySavedNotice, setApiKeySavedNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load custom API key from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedKey = localStorage.getItem("bizmate_gemini_api_key") || "";
      setActiveApiKey(storedKey);
      setApiKeyInput(storedKey);
    }
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Initial welcome message from autonomous agent collective (English by default)
  useEffect(() => {
    if (messages.length === 0) {
      const session = getSession();
      const displayName = session?.user?.businessName || session?.user?.email?.split("@")[0] || "Business Owner";
      setMessages([
        {
          id: "welcome-1",
          senderType: "AGENT",
          agentId: "trust",
          content: `Hello ${displayName}! Our 6 Autonomous Financial Agents are on standby to monitor your cash liquidity, credit health, accounts receivable, and trade risks. Feel free to ask any financial question in English or ภาษาไทย!`,
          reasoning: "Glass-Box Collective AI: Synchronized with live operational bank ledger and multi-agent signals.",
          actionRoute: "/dashboard#joint-plan",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, []);

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    setActiveApiKey(trimmed);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizmate_gemini_api_key", trimmed);
    }
    setApiKeySavedNotice(true);
    setTimeout(() => {
      setApiKeySavedNotice(false);
      setShowSettings(false);
    }, 1200);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputMessage).trim();
    if (!message || isLoading) return;

    setInputMessage("");
    const session = getSession();
    if (!session?.token) return;

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      senderType: "USER",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          message,
          sessionId,
          apiKey: activeApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.agentMessage) {
        setMessages((prev) => [...prev, data.agentMessage]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      // Fallback response inside UI
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          senderType: "AGENT",
          agentId: "trust",
          content: "ขออภัยครับ ระบบกำลังเชื่อมต่อฐานข้อมูล กรุณาลองส่งข้อความใหม่อีกครั้งครับ",
          reasoning: "Network error recovery protocol",
          actionRoute: "/dashboard",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ========================================================
          FLOATING CHAT TRIGGER BUTTON (Bottom-Right)
      ======================================================== */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            aria-label="Open AI Financial Copilot Chat"
          >
            {/* Pulsing beacon glow */}
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-ping" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />

            <div className="w-6 h-6 flex items-center justify-center text-lg animate-bounce">
              🤖
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold leading-none">BizMate AI Copilot</span>
              <span className="text-[10px] text-blue-100/90 font-mono font-normal">6 Agents Active</span>
            </div>
          </button>
        )}
      </div>

      {/* ========================================================
          SLIDE-OVER / FLOATING CHAT BOX (Does NOT navigate to new page)
      ======================================================== */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[460px] h-[640px] max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up transition-all duration-300">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-lg border border-white/20">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold leading-tight">AI Financial Copilot</h3>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                    {activeApiKey && activeApiKey !== "abcde" ? "Gemini 1.5 Flash" : "Glass Box Engine"}
                  </span>
                </div>
                <p className="text-[11px] text-blue-100 font-mono">
                  Autonomous Multi-Agent Glass Box
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* API Key Settings Button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-xl hover:bg-white/15 text-blue-100 hover:text-white transition-colors cursor-pointer text-xs"
                title="Configure Google Gemini API Key"
              >
                ⚙️
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl hover:bg-white/15 text-blue-100 hover:text-white transition-colors cursor-pointer text-sm font-bold"
                aria-label="Close Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* API Key Settings Drawer (Collapsible) */}
          {showSettings && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-xs animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>🔑</span>
                  <span>Google AI Studio Key (Gemini)</span>
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Get free key ↗
                </a>
              </div>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                ใส่ Google Gemini API Key ของคุณที่นี่เพื่อเปิดใช้ AI เต็มรูปแบบ (ใช้ Gemini 1.5 Flash ฟรี 1,500 requests/วัน)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="เช่น AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                >
                  Save
                </button>
              </div>
              {apiKeySavedNotice && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1.5 animate-in fade-in">
                  ✓ บันทึก API Key เรียบร้อยแล้ว!
                </p>
              )}
            </div>
          )}

          {/* Chat Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isUser = msg.senderType === "USER";
              const agent = msg.agentId ? AGENTS_META[msg.agentId.toLowerCase()] : AGENTS_META.trust;

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end animate-fade-in-up">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-xs leading-relaxed shadow-sm font-sans">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex flex-col items-start gap-1.5 animate-fade-in-up max-w-[92%]">
                  {/* Originating Agent Chip (PRD AI-01) */}
                  {agent && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold font-mono ${agent.bg}`}>
                      <span>{agent.emoji}</span>
                      <span className={agent.color}>{agent.name}</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs leading-relaxed shadow-xs space-y-2 border border-slate-200/80 dark:border-slate-700/60 w-full">
                    <p className="whitespace-pre-line font-sans">{msg.content}</p>

                    {/* Glass-box Reasoning Deliberation Trace (Axiom 1) */}
                    {msg.reasoning && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-start gap-1.5 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl">
                        <span>🔍</span>
                        <span className="italic leading-normal">{msg.reasoning}</span>
                      </div>
                    )}

                    {/* Actionable View Route Link (Chat Explains, Screens Act - Axiom 4) */}
                    {msg.actionRoute && (
                      <div className="pt-1 flex justify-end">
                        <Link
                          href={msg.actionRoute}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs transition-colors"
                        >
                          <span>Go to Screen</span>
                          <span>→</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-500 w-fit animate-pulse">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Analyzing financial telemetry across 6 agents...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggested Prompts (When history is short) */}
          {messages.length <= 3 && !isLoading && (
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto text-[11px] font-mono scrollbar-none shrink-0">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 whitespace-nowrap transition-colors cursor-pointer shrink-0 border border-slate-200/60 dark:border-slate-700/60 text-[10px]"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Box Footer */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about cash runway, buffer breaches, loans, receivables..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center shrink-0 w-10 h-10"
                aria-label="Send Message"
              >
                <span>➤</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
