// Global in-memory storage of AI call logs for development & admin telemetry.
// Preserves the latest 100 calls across all tasks (document_reading, chat, etc.).

import type { MaskEntry } from "./masking";

export interface LoggedAiCall {
  id: string;
  task: string;
  at: string;
  systemPrompt: string;
  maskedPrompt: string;
  mapping: MaskEntry[];
  maskedReply: string;
  unmaskedReply: string;
  model: string;
  temperature: number;
  status?: "success" | "fallback" | "error";
  errorMessage?: string;
  latencyMs?: number;
}

const callLogs: LoggedAiCall[] = [];
const lastCallByTask = new Map<string, LoggedAiCall>();

export function recordAiCall(entry: Omit<LoggedAiCall, "id"> & { id?: string }): LoggedAiCall {
  const fullEntry: LoggedAiCall = {
    ...entry,
    status: entry.status || "success",
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  callLogs.unshift(fullEntry);
  if (callLogs.length > 100) {
    callLogs.pop();
  }

  lastCallByTask.set(fullEntry.task, fullEntry);
  return fullEntry;
}

export function getAllAiCalls(): LoggedAiCall[] {
  return [...callLogs];
}

export function getLastAiCall(task: string): LoggedAiCall | null {
  return lastCallByTask.get(task) ?? null;
}

export function clearAiLogs(): void {
  callLogs.length = 0;
  lastCallByTask.clear();
}
