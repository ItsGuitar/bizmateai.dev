"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, AuthUser } from "@/lib/auth-client";

interface UserProfileMenuProps {
  user: AuthUser | null;
  onLogout?: () => void;
  showAccountModal?: () => void;
}

export function UserProfileMenu({ user, onLogout, showAccountModal }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Determine display name and initial
  const displayName = user?.businessName || user?.email?.split("@")[0] || "User";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const email = user?.email || "";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogoutClick = () => {
    setIsOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      clearSession();
      router.push("/");
    }
  };

  const handleAccountClick = () => {
    setIsOpen(false);
    if (showAccountModal) {
      showAccountModal();
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <div className="flex items-center gap-2.5">
        {/* Name display to the left of the avatar */}
        <span className="hidden sm:inline-block text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[140px] md:max-w-[180px] truncate">
          {displayName}
        </span>

        {/* Circular Avatar Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white font-bold text-sm flex items-center justify-center shadow-sm hover:ring-2 hover:ring-blue-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={`${displayName} (${email})`}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {initial}
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Info */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {displayName}
            </p>
            {email && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {email}
              </p>
            )}
          </div>

          <div className="py-1">
            {/* Account Option */}
            <button
              onClick={handleAccountClick}
              className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <span className="text-base leading-none">👤</span>
              <span>Account</span>
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

          {/* Log Out Option */}
          <div className="py-0.5">
            <button
              onClick={handleLogoutClick}
              className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <span className="text-base leading-none">🚪</span>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
