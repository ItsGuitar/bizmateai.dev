"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { clearSession, AuthUser } from "@/lib/auth-client";

interface AppHeaderProps {
  user?: AuthUser | null;
}

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-2 group shrink-0">
          <span
            style={{ fontFamily: "var(--font-logo)" }}
            className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity"
          >
            BizMate<span className="text-blue-500 dark:text-cyan-400 text-base font-mono align-top ml-0.5">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <UserProfileMenu user={user ?? null} onLogout={handleLogout} />
        </div>
      </div>
    </header>
  );
}
