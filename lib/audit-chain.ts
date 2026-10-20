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

// A real binary Merkle tree: pair up hashes, hash each pair, repeat until one root remains.
// An odd node out is paired with itself (standard duplicate-last padding) rather than left bare.
export async function merkleRootOf(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return GENESIS_HASH;
  let level = hashes;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(await sha256Hex(left + right));
    }
    level = next;
  }
  return level[0];
}

export interface DailyMerkleRoot {
  date: string;
  count: number;
  root: string;
}

// Groups entries by their ts's calendar date and computes one Merkle root per day, matching
// NEW_DESIGN.md Section 8's "daily Merkle root" requirement.
export async function dailyMerkleRoots(entries: AuditChainable[], hashes: string[]): Promise<DailyMerkleRoot[]> {
  const byDate = new Map<string, string[]>();
  entries.forEach((entry, i) => {
    const date = entry.ts.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(hashes[i]);
    byDate.set(date, list);
  });
  const roots = await Promise.all(
    Array.from(byDate.entries()).map(async ([date, dayHashes]) => ({
      date,
      count: dayHashes.length,
      root: await merkleRootOf(dayHashes),
    }))
  );
  return roots.sort((a, b) => a.date.localeCompare(b.date));
}
