// Server-only model configuration. Never import this from a "use client" file: the API key must
// never reach the browser bundle. Next.js already keeps any env var that isn't prefixed
// NEXT_PUBLIC_ out of client bundles, but routing all model config through here (API routes and
// server actions only) is the contract that keeps the key on the server, full stop.

export type AiTaskType = "document_reading" | "qa" | "chat" | "reword_reminder" | "daily_brief";

// Low temperature everywhere: this product never lets the model invent a number, so creativity
// is a liability here, not a feature. Document reading gets the lowest setting since a misread
// field is the worst failure mode (NEW_DESIGN.md Section 7, system rules; Section 8 self-assessment,
// "Wrong numbers from the model").
export const TEMPERATURE: Record<AiTaskType, number> = {
  document_reading: 0.1,
  qa: 0.2,
  chat: 0.2,
  reword_reminder: 0.3,
  daily_brief: 0.2,
};

export const MODEL_NAME = "gemini-3.5-flash-lite";

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env, server-side only, never as NEXT_PUBLIC_.");
  }
  return key;
}
