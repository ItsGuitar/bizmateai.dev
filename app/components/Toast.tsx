"use client";

import React, { useEffect, useState } from "react";

interface ToastProps {
  message: string | null;
  onDone: () => void;
  duration?: number;
}

export function Toast({ message, onDone, duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!message) return;

    setIsVisible(true);
    const hideTimer = setTimeout(() => setIsVisible(false), duration - 250);
    const doneTimer = setTimeout(() => onDone(), duration);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, [message, duration, onDone]);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-250 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold shadow-2xl border border-slate-800 dark:border-slate-200">
        <span className="w-5 h-5 rounded-full bg-emerald-500 dark:bg-emerald-400 text-white flex items-center justify-center text-xs font-bold shrink-0">
          ✓
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}
