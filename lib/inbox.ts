import { prisma } from "@/lib/prisma";

export interface CreateApprovalInput {
  userId: string;
  agentId: string;
  title: string;
  description: string;
  impact?: string;
  requiresFaceId?: boolean;
}

// Shared by app/api/inbox (owner-triggered actions) and app/api/workflow (agent-room runs):
// every proposed action becomes one InboxApproval, paired with one AuditLog row.
export async function createApproval({
  userId,
  agentId,
  title,
  description,
  impact,
  requiresFaceId = false,
}: CreateApprovalInput) {
  const item = await prisma.inboxApproval.create({
    data: {
      userId,
      agentId,
      title,
      description,
      impact: impact || "Pending owner approval",
      status: "PENDING",
      requiresFaceId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      agentId,
      action: `Created approval card: ${title}`,
      status: "DONE",
    },
  });

  return item;
}

// Re-opening the same Agent Room run (page reload, re-navigation) must not pile up duplicate
// PENDING cards for the same proposed action. Reuse the existing PENDING row for this
// userId+title+agentId if one is already there; only create when none exists.
export async function findOrCreateApproval(input: CreateApprovalInput) {
  const existing = await prisma.inboxApproval.findFirst({
    where: { userId: input.userId, agentId: input.agentId, title: input.title, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return createApproval(input);
}
