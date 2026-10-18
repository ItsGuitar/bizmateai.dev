import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { findOrCreateApproval } from "@/lib/inbox";
import { runCollectWorkflow } from "@/lib/workflow-engine";

export async function POST(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const run = await runCollectWorkflow(userId);

    const approvalIds = await Promise.all(
      run.approvals.map((approval) =>
        findOrCreateApproval({
          userId,
          agentId: approval.agent,
          title: approval.title,
          description: approval.detail,
          impact: approval.impact,
        })
      )
    );

    const approvals = run.approvals.map((approval, i) => ({ ...approval, id: approvalIds[i].id }));

    return NextResponse.json({ success: true, run: { ...run, approvals } });
  } catch (err: any) {
    console.error("collect workflow error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
