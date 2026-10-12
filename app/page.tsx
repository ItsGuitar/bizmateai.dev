"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AGENTS, AgentDefinition } from "./data/agents";
import { ThemeToggle } from "./components/ThemeToggle";
import { getSession, AuthUser } from "@/lib/auth-client";

export default function WelcomePage() {
  const [activeAgent, setActiveAgent] = useState<AgentDefinition | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const session = getSession();
    if (session?.user) {
      setUser(session.user);
    }
  }, []);

  const scrollToAgents = () => {
    const el = document.getElementById("agents-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white relative overflow-x-hidden transition-colors duration-300">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[750px] h-[450px] bg-gradient-to-b from-blue-500/10 dark:from-blue-600/15 via-indigo-500/5 dark:via-indigo-600/10 to-transparent blur-3xl pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute top-1/3 -right-20 w-96 h-96 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation with fade-in */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-end z-10 animate-fade-in-up">
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          {isMounted && user ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <span className="font-semibold text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                  {user.businessName || user.email}
                </span>
              </div>
              <Link
                href="/dashboard"
                className="text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Go to Dashboard</span>
                <span>→</span>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* SCREEN 1: Hero Section (Full Viewport Height) */}
      <section className="min-h-[calc(100vh-80px)] w-full max-w-4xl mx-auto px-6 flex flex-col items-center justify-center text-center z-10 py-4 sm:py-6">
        {/* Prominent Centered Brand Logo with smooth scale entrance */}
        <div className="flex flex-col items-center mb-3 cursor-default">
          <div className="relative mb-2 flex items-center justify-center animate-fade-in-scale">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-6 sm:-inset-8 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 rounded-full blur-2xl opacity-35 dark:opacity-50 pointer-events-none" />

            <div className="relative w-72 sm:w-[480px] md:w-[620px] lg:w-[700px] aspect-[21/8] flex items-center justify-center transition-transform duration-500 hover:scale-[1.02]">
              <Image
                src="/images/logo.png"
                alt="BizMate Logo"
                fill
                priority
                unoptimized
                className="object-contain drop-shadow-md select-none"
              />
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight mt-1 text-slate-900 dark:text-white leading-tight max-w-2xl animate-fade-in-up delay-100">
            Never run out of cash. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 dark:from-blue-400 dark:via-indigo-300 dark:to-sky-300 bg-clip-text text-transparent">
              Built for cross-border MSMEs.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal max-w-lg mt-2 leading-relaxed animate-fade-in-up delay-200">
            Your unified financial copilot. Radar liquidity projections, lowest-cost capital, and zero surprise payments.
          </p>
        </div>

        {/* 3 Core Trust Proofs with stagger */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 my-4 font-medium animate-fade-in-up delay-300">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
              ✓
            </span>
            <span>Zero-surprise approval inbox</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
              ✓
            </span>
            <span>Read-only bank data guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
              ✓
            </span>
            <span>Setup in under 2 minutes</span>
          </div>
        </div>

        {/* Call to Actions on Screen 1 with stagger */}
        <div className="w-full max-w-xs flex flex-col gap-2.5 mt-1 animate-fade-in-up delay-400">
          {isMounted && user ? (
            <Link
              href="/dashboard"
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Go to Dashboard</span>
              <span className="text-lg">→</span>
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Get started</span>
                <span className="text-lg">→</span>
              </Link>
              <Link
                href="/login"
                className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                I already have an account
              </Link>
            </>
          )}
        </div>

        {/* Smooth Scroll Cue */}
        <button
          onClick={scrollToAgents}
          className="mt-4 sm:mt-6 flex flex-col items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer group animate-bounce animate-fade-in-up delay-500"
        >
          <span>Explore how BizMate works</span>
          <svg
            className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </section>

      {/* SCREEN 2: Financial Capabilities Section */}
      <section
        id="agents-section"
        className="w-full max-w-6xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center z-10"
      >
        <div className="max-w-xl mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-blue-600 dark:text-blue-400 font-bold">
            Unified Financial Intelligence
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
            How BizMate Powers Your Business
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Automating cash radar, working capital, and AR follow-ups under deterministic trust.
          </p>
        </div>

        {/* 6 High-End Agent Cards - Centered Layout with staggered cascade */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 mb-12">
          {AGENTS.map((agent, index) => {
            const delayClasses = [
              "delay-100",
              "delay-200",
              "delay-300",
              "delay-400",
              "delay-500",
              "delay-600",
            ];
            const delayClass = delayClasses[index % delayClasses.length];

            return (
              <div
                key={agent.id}
                onClick={() => setActiveAgent(agent)}
                className={`group relative rounded-3xl p-6 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 shadow-xs hover:shadow-xl dark:shadow-none cursor-pointer overflow-hidden flex flex-col items-center text-center justify-between animate-fade-in-up backdrop-blur-sm ${delayClass}`}
              >
                {/* Subtle Card Glow Effect */}
                <div
                  className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ backgroundColor: `${agent.color}15` }}
                />

                <div className="flex flex-col items-center w-full">
                  {/* Centered Emoji Icon with Badge */}
                  <div className="relative mb-4 flex flex-col items-center">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xs border border-slate-200/80 dark:border-slate-700/60 transition-transform duration-300 group-hover:scale-110 bg-slate-50 dark:bg-slate-800"
                    >
                      <span>{agent.emoji}</span>
                    </div>

                    <span className="mt-2.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {agent.badge}
                    </span>
                  </div>

                  {/* Centered Agent Name & Role */}
                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
                    {agent.role}
                  </p>

                  {/* Centered Tagline */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">
                    {agent.tagline}
                  </p>
                </div>

                {/* Centered Stat Strip */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/60 w-full flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500">
                    {agent.statLabel}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {agent.highlightStat}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Secondary CTA below cards */}
        <Link
          href={isMounted && user ? "/dashboard" : "/register"}
          className="py-3.5 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          {isMounted && user ? "Go to Dashboard →" : "Get started with BizMate →"}
        </Link>
      </section>

      {/* Modal for In-Depth Agent Details */}
      {activeAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setActiveAgent(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 sm:p-7 max-w-md w-full text-left shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Background Glow */}
            <div
              className={`absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br ${activeAgent.glowGradient} rounded-full blur-3xl pointer-events-none`}
            />

            <button
              onClick={() => setActiveAgent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800"
              >
                {activeAgent.emoji}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                    {activeAgent.name}
                  </h4>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    {activeAgent.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{activeAgent.role}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 mb-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Primary Capability
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {activeAgent.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                  {activeAgent.statLabel}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeAgent.highlightStat}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                  Consent Boundary
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Zero-Surprise OK
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveAgent(null)}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Clean Bottom Footer */}
      <footer className="w-full border-t border-slate-200/70 dark:border-slate-900 py-6 text-center text-xs text-slate-500 z-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
        <span>BizMate MSME Financial Copilot • Bank-Grade Deterministic Security</span>
        <div className="flex items-center gap-4 text-xs font-medium">
          <Link href="/docs" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            API Docs (Swagger)
          </Link>
          <span>•</span>
          <Link href="/pdpa" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            PDPA Compliance
          </Link>
        </div>
      </footer>
    </div>
  );
}
