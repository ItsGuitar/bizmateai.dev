import { prisma } from "@/lib/prisma";
import type { AuditEntrySeed } from "@/app/data/trust-mock";

// Real AuditLog rows don't carry a tier/detail split the way the Trust page's hash-chain demo
// expects (lib/audit-chain.ts AuditChainable) — "tier" is derived from the action text since the
// row itself only has a free-text action + DONE/SENT/FLAGGED/BLOCKED status.
function tierFor(action: string): 0 | 1 | 2 | 3 {
  const lower = action.toLowerCase();
  if (lower.includes("approved") || lower.includes("declined") || lower.includes("sent")) return 2;
  if (lower.includes("created approval card") || lower.includes("drafted")) return 1;
  return 0;
}

// The real, append-only audit trail (approvals, calculations, reminders, everything
// app/api/inbox and app/api/documents/calculate already write to Prisma AuditLog), shared by
// /api/audit (Trust page view) and /api/audit/export (sandbox_operation_logs.json download).
export async function getAuditEntries(userId: string): Promise<AuditEntrySeed[]> {
  const logs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
  });

  return logs.map((log, i) => ({
    seq: i + 1,
    ts: log.timestamp.toISOString(),
    actor: log.agentId,
    action: log.status,
    detail: log.action,
    tier: tierFor(log.action),
    approval: null,
  }));
}
