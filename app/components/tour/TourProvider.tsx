"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { TOUR_STEPS } from "./tourSteps";

const STORAGE_KEY = "bizmate-tour-state";

interface TourState {
  active: boolean;
  stepIndex: number;
}

interface TourContextValue extends TourState {
  totalSteps: number;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

function readState(): TourState {
  if (typeof window === "undefined") return { active: false, stepIndex: 0 };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { active: false, stepIndex: 0 };
    const parsed = JSON.parse(raw);
    return {
      active: Boolean(parsed.active),
      stepIndex: Number.isFinite(parsed.stepIndex) ? parsed.stepIndex : 0,
    };
  } catch {
    return { active: false, stepIndex: 0 };
  }
}

function writeState(state: TourState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TourState>({ active: false, stepIndex: 0 });

  useEffect(() => {
    setState(readState());
  }, []);

  const update = useCallback((next: TourState) => {
    setState(next);
    writeState(next);
  }, []);

  const start = useCallback(() => update({ active: true, stepIndex: 0 }), [update]);

  const next = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.stepIndex + 1;
      const nextState = nextIndex >= TOUR_STEPS.length ? { active: false, stepIndex: 0 } : { active: true, stepIndex: nextIndex };
      writeState(nextState);
      return nextState;
    });
  }, []);

  const back = useCallback(() => {
    setState((prev) => {
      const prevIndex = Math.max(0, prev.stepIndex - 1);
      const nextState = { active: true, stepIndex: prevIndex };
      writeState(nextState);
      return nextState;
    });
  }, []);

  const skip = useCallback(() => update({ active: false, stepIndex: 0 }), [update]);

  return (
    <TourContext.Provider
      value={{ ...state, totalSteps: TOUR_STEPS.length, start, next, back, skip }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
