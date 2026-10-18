"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { useTour } from "@/app/components/tour/TourProvider";
import { clearSession, AuthUser } from "@/lib/auth-client";

interface AppHeaderProps {
  user?: AuthUser | null;
}

const TOOLS_LINKS = [
  { href: "/dashboard/data", label: "Data" },
  { href: "/dashboard/new-order", label: "New order" },
  { href: "/dashboard/receivables", label: "Receivables" },
  { href: "/dashboard/procurement", label: "Procurement" },
  { href: "/dashboard/financing", label: "Financing" },
  { href: "/dashboard/trust", label: "Trust" },
  { href: "/dashboard/generator", label: "Generator" },
  { href: "/dashboard/agent-room", label: "Agent Room" },
];

const CLOSE_BUFFER_MS = 200;

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { start: startTour } = useTour();

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    if (isToolsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isToolsOpen]);

  const openTools = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsToolsOpen(true);
  };

  const scheduleCloseTools = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setIsToolsOpen(false), CLOSE_BUFFER_MS);
  };

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  const handleRunTutorial = () => {
    setIsMobileOpen(false);
    startTour();
  };

  const isToolsActive = TOOLS_LINKS.some((link) => pathname?.startsWith(link.href));

  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 group shrink-0">
          <span
            style={{ fontFamily: "var(--font-logo)" }}
            className="text-2xl font-black text-blue-600 dark:text-blue-400 group-hover:opacity-90 transition-opacity"
          >
            BizMate<span className="text-blue-500 dark:text-cyan-400 text-base font-mono align-top ml-0.5">AI</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
              pathname === "/dashboard"
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Dashboard
          </Link>

          <Link
            href="/dashboard/inbox"
            className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
              pathname?.startsWith("/dashboard/inbox")
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Inbox
          </Link>

          <div
            ref={toolsRef}
            className="relative"
            onMouseEnter={openTools}
            onMouseLeave={scheduleCloseTools}
          >
            <button
              type="button"
              onClick={openTools}
              className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1 ${
                isToolsActive
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              aria-expanded={isToolsOpen}
            >
              <span>Tools &amp; Agents</span>
              <span className="text-[10px]">▼</span>
            </button>

            {isToolsOpen && (
              <div className="absolute left-0 top-full pt-1.5 w-52 z-50">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  {TOOLS_LINKS.map((link) => {
                    const isActive = pathname?.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsToolsOpen(false)}
                        className={`block px-4 py-2 text-xs font-semibold transition-colors ${
                          isActive
                            ? "text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/docs"
            className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
              pathname?.startsWith("/docs")
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Docs
          </Link>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunTutorial}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>▶</span>
            <span>Run Tutorial</span>
          </button>

          <ThemeToggle />
          <UserProfileMenu user={user ?? null} onLogout={handleLogout} />

          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle menu"
            aria-expanded={isMobileOpen}
          >
            {isMobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {isMobileOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-0.5 animate-fade-in">
          <Link
            href="/dashboard"
            onClick={() => setIsMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/inbox"
            onClick={() => setIsMobileOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Inbox
          </Link>
          <p className="px-3 pt-2.5 pb-1 text-[11px] font-mono uppercase font-bold text-slate-400">
            Tools &amp; Agents
          </p>
          {TOOLS_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
            <Link
              href="/docs"
              onClick={() => setIsMobileOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Docs
            </Link>
            <button
              type="button"
              onClick={handleRunTutorial}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
            >
              ▶ Run Tutorial
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
