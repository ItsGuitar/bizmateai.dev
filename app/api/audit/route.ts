import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
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

// GET: the real, append-only audit trail for the Trust page (approvals, calculations, reminders,
// everything app/api/inbox and app/api/documents/calculate already write to Prisma AuditLog).
export async function GET(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: "asc" },
    });

    const entries: AuditEntrySeed[] = logs.map((log, i) => ({
      seq: i + 1,
      ts: log.timestamp.toISOString(),
      actor: log.agentId,
      action: log.status,
      detail: log.action,
      tier: tierFor(log.action),
      approval: null,
    }));

    return NextResponse.json({ success: true, entries });
  } catch (err: any) {
    console.error("Audit GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
