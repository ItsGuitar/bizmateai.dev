"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { clearSession, AuthUser } from "@/lib/auth-client";

interface AppHeaderProps {
  user?: AuthUser | null;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/data", label: "Data" },
  { href: "/dashboard/new-order", label: "New order" },
  { href: "/dashboard/receivables", label: "Receivables" },
  { href: "/dashboard/procurement", label: "Procurement" },
  { href: "/dashboard/financing", label: "Financing" },
  { href: "/dashboard/trust", label: "Trust" },
  { href: "/dashboard/generator", label: "Generator" },
];

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

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

        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle />
          <UserProfileMenu user={user ?? null} onLogout={handleLogout} />
        </div>
      </div>
    </header>
  );
}
