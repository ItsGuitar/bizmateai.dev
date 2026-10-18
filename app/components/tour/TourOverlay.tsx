"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTour } from "./TourProvider";
import { TOUR_STEPS } from "./tourSteps";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export function TourOverlay() {
  const { active, stepIndex, totalSteps, next, back, skip } = useTour();
  const pathname = usePathname();
  const router = useRouter();
  const [rect, setRect] = useState<Rect | null>(null);
  const lastPushedRef = useRef<string | null>(null);

  const step = active ? TOUR_STEPS[stepIndex] : null;

  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }

    if (pathname !== step.route && lastPushedRef.current !== `${step.id}:${step.route}`) {
      lastPushedRef.current = `${step.id}:${step.route}`;
      router.push(step.route);
      return;
    }

    if (pathname !== step.route) return;

    let cancelled = false;
    let attempts = 0;

    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const box = el.getBoundingClientRect();
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
        return;
      }
      attempts += 1;
      if (attempts < 30) {
        setTimeout(locate, 150);
      } else {
        setRect(null);
      }
    };

    locate();
    const onScrollOrResize = () => locate();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [step, pathname, router]);

  if (!step) return null;

  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  const cardTop = rect ? Math.min(window.innerHeight - 220, rect.top + rect.height + 16) : window.innerHeight / 2 - 90;
  const cardLeft = rect ? Math.max(16, Math.min(window.innerWidth - 336, rect.left)) : window.innerWidth / 2 - 160;

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      {rect ? (
        <div
          className="absolute rounded-2xl ring-2 ring-blue-500 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/55" />
      )}

      <div
        className="absolute w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 pointer-events-auto animate-fade-in"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wide">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={skip}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            Skip tour
          </button>
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{step.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{step.body}</p>

        <div className="flex items-center gap-2 mt-3.5">
          {!isFirst && (
            <button
              type="button"
              onClick={back}
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="text-xs font-bold px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer ml-auto"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
