// Shared hash-chain helpers for the tamper-evident audit log (NEW_DESIGN.md Section 8).
// Each entry's hash covers its own fields plus the previous entry's hash, so editing any entry
// changes every hash after it. Used by the Trust page's live verify/tamper demo and by the
// AI-context snapshot builder, so both compute the chain the exact same way.

export interface AuditChainable {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  detail: string;
  tier: 0 | 1 | 2 | 3;
  approval: string | null;
}

export const GENESIS_HASH = "0".repeat(64);

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function canonicalString(entry: AuditChainable, prevHash: string): string {
  return JSON.stringify([entry.seq, entry.ts, entry.actor, entry.action, entry.detail, entry.tier, entry.approval, prevHash]);
}

export async function computeChain(entries: AuditChainable[]): Promise<string[]> {
  const hashes: string[] = [];
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    const hash = await sha256Hex(canonicalString(entry, prevHash));
    hashes.push(hash);
    prevHash = hash;
  }
  return hashes;
}

export async function merkleRootOf(hashes: string[]): Promise<string> {
  return sha256Hex(hashes.join(""));
}
