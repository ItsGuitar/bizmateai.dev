"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChatAction, ChatToolResult } from "@/app/api/ai/chat/route";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  tool?: ChatToolResult;
  action?: ChatAction | null;
  timestamp: string;
}

const PAGE_CONTEXT_NAMES: Record<string, { title: string; subtitle: string; botIcon: string }> = {
  home: { title: "Lead Copilot", subtitle: "Executive Dashboard Assistant", botIcon: "/images/bot10_wave.png" },
  data: { title: "Data Integrator", subtitle: "Multi-Bank & Statement Assistant", botIcon: "/images/bot08_tablet.png" },
  "new-order": { title: "Order Evaluator", subtitle: "Feasibility & Cash Gap Specialist", botIcon: "/images/bot01_thumbup.png" },
  receivables: { title: "Receivables Specialist", subtitle: "Collections & Debtor Habit Agent", botIcon: "/images/bot06_stand_neutral.png" },
  procurement: { title: "Procurement Specialist", subtitle: "Material Price & Hedging Agent", botIcon: "/images/bot04_box_front.png" },
  financing: { title: "Financing Specialist", subtitle: "Working Capital & Credit Agent", botIcon: "/images/bot03_celebrate.png" },
  trust: { title: "Trust & Audit Officer", subtitle: "Deterministic Audit Log Agent", botIcon: "/images/bot02_sit.png" },
  generator: { title: "Doc Specialist", subtitle: "Mock Document Assistant", botIcon: "/images/bot05_box_side.png" },
};

export function AskBizMateChat() {
  const pathname = usePathname();
  const router = useRouter();

  // Explicitly hide chat widget on landing page, login, register, and onboarding
  const isExcludedPage =
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/onboarding");

  // Extract page context slug
  const pageSlug = pathname?.split("/")[2] || "home";
  const currentPersona = PAGE_CONTEXT_NAMES[pageSlug] || PAGE_CONTEXT_NAMES.home;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-welcome",
      sender: "bot",
      text: `Hello! I'm your ${currentPersona.title}. How can I assist you on this page today?`,
      timestamp: "Just now",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPageSlugRef = useRef<string>(pageSlug);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  // Lets other pages (e.g. the "Ask Financing" button) open this chat and optionally queue a
  // question, instead of duplicating a second chat UI per page.
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const prefill = (e as CustomEvent<{ prefill?: string }>).detail?.prefill;
      setIsOpen(true);
      if (prefill) setInput(prefill);
    };
    window.addEventListener("bizmate_open_chat", handleOpenChat);
    return () => window.removeEventListener("bizmate_open_chat", handleOpenChat);
  }, []);

  // Only announce when user actually navigates to a DIFFERENT page route
  useEffect(() => {
    if (isExcludedPage) return;
    if (lastPageSlugRef.current === pageSlug) return;
    lastPageSlugRef.current = pageSlug;

    setMessages((prev) => [
      ...prev,
      {
        id: `m-page-${Date.now()}`,
        sender: "bot",
        text: `Switched to ${currentPersona.title} mode for /dashboard/${pageSlug === "home" ? "" : pageSlug}. How can I assist you on this screen?`,
        timestamp: "Just now",
      },
    ]);
  }, [pageSlug, currentPersona.title, isExcludedPage]);

  if (isExcludedPage) {
    return null;
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Extract up to last 5 QA pairs (10 messages) excluding welcome
    const recentHistory = messages
      .filter((m) => m.id !== "m-welcome")
      .slice(-10)
      .map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        text: m.text,
      }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          pageContext: pageSlug,
          history: recentHistory,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const botMsg: Message = {
          id: `b-${Date.now()}`,
          sender: "bot",
          text: data.reply,
          tool: data.tool,
          action: data.action,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(data.error || "Failed to respond");
      }
    } catch (err: any) {
      const isQuota = err?.message?.toLowerCase().includes("quota") || err?.message?.toLowerCase().includes("limit");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "bot",
          text: isQuota
            ? `⚠️ ${err.message}`
            : (err?.message || "I encountered a connection issue. Please try again."),
          timestamp: "Just now",
        },
      ]);

    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    if (action.href) {
      router.push(action.href);
      setIsOpen(false);
    }
  };

  // Helper to format text with bold (**text**), inline code (`code`), and clean paragraphs
  const renderFormattedMessage = (rawText: string) => {
    // 1. Clean up any accidental raw route paths like (`/dashboard/...`) or (/dashboard/...)
    const sanitized = rawText.replace(/\(?`?\/dashboard\/[a-zA-Z0-9_\-\/]+`?\)?/g, "").replace(/\s{2,}/g, " ");

    const paragraphs = sanitized.split("\n").filter((p) => p.trim() !== "");

    return paragraphs.map((paragraph, pIdx) => {
      // Split by bold (**bold**) and inline code (`code`)
      const parts = paragraph.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

      return (
        <p key={pIdx} className="leading-relaxed">
          {parts.map((part, idx) => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
              return (
                <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
              return (
                <code key={idx} className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 font-mono text-[11px] text-blue-600 dark:text-blue-300">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  const quickPrompts = [
    { label: "Check Shenzhen ElectroParts", text: "How is Shenzhen ElectroParts paying and is anything overdue?" },
    { label: "Evaluate New Order", text: "Can you check order feasibility and margin for an order of 2,000 units?" },
    { label: "Material Price Trend", text: "What is the current market price trend for Cold-rolled steel?" },
    { label: "Request Approval Card", text: "Propose an action card to split the next material lot into two parts." },
  ];

  return (
    <>
      {/* Floating Action Button (Bottom Right) */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-cyan-400 p-1.5 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/80 dark:border-slate-800 cursor-pointer"
          aria-label="Ask BizMateAI Chat"
          title="Ask BizMateAI Chat"
        >
          {/* Animated Glow Halo */}
          <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-md group-hover:bg-blue-400/50 transition-all duration-300" />

          {/* Bot Image */}
          <div className="relative w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
            <Image
              src="/images/bot10_wave.png"
              alt="BizMateAI Bot"
              width={56}
              height={56}
              className="w-12 h-12 object-contain drop-shadow select-none group-hover:rotate-6 transition-transform"
            />
          </div>

          {/* Online status indicator */}
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs" />
        </button>
      </div>

      {/* Chat Popover Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] max-h-[85vh] h-[600px] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="px-5 py-3.5 bg-blue-600 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-700 p-1 border border-blue-500 flex items-center justify-center">
                <Image
                  src={currentPersona.botIcon}
                  alt={currentPersona.title}
                  width={36}
                  height={36}
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-1.5 leading-tight">
                  {currentPersona.title}
                  <span className="text-[10px] bg-blue-700 px-1.5 py-0.5 rounded-full font-mono uppercase font-semibold">
                    Live Tooling
                  </span>
                </h3>
                <p className="text-[11px] text-blue-100 font-medium opacity-90 leading-tight">
                  {currentPersona.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-blue-700 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer text-lg"
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden border border-blue-200 dark:border-slate-700 mt-0.5">
                    <Image
                      src={currentPersona.botIcon}
                      alt="Bot"
                      width={24}
                      height={24}
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-2`}>
                  <div
                    className={`p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/60 dark:border-slate-700/60"
                    }`}
                  >
                    {/* Formatted Markdown Content */}
                    <div className="space-y-1.5 leading-relaxed">
                      {renderFormattedMessage(msg.text)}
                    </div>

                    {/* Tool Data Card */}
                    {msg.tool && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                        <div className="flex items-center gap-1 font-mono font-bold text-blue-600 dark:text-blue-400">
                          <span>⚙️ Tool Result:</span>
                          <span className="uppercase">{msg.tool.toolName}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-medium leading-normal">
                          {msg.tool.summary}
                        </p>
                      </div>
                    )}

                    {/* Actionable Button */}
                    {msg.action && (
                      <div className="mt-2.5 pt-1.5">
                        <button
                          type="button"
                          onClick={() => handleActionClick(msg.action!)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all cursor-pointer group"
                        >
                          <span>{msg.action.label}</span>
                          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1 block">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                  <span className="text-xs animate-spin">⚙️</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  <span>Analyzing data & executing tool...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInput(q.text);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${currentPersona.title}...`}
              className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
