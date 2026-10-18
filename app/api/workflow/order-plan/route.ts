import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { findOrCreateApproval } from "@/lib/inbox";
import { runOrderPlanWorkflow } from "@/lib/workflow-engine";
import { DEFAULT_ORDER_INPUT, type OrderInput } from "@/lib/order-engine";

// The owner's own order from the "New order" form (lib/order-engine.ts OrderInput), if they sent
// one through; otherwise the project's demo order.
function parseOrderInput(body: any): OrderInput {
  const raw = body?.orderInput;
  if (!raw || typeof raw !== "object" || !raw.qty || !raw.pricePerUnit) return DEFAULT_ORDER_INPUT;
  return { ...DEFAULT_ORDER_INPUT, ...raw };
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const orderInput = parseOrderInput(body);
    const run = await runOrderPlanWorkflow(userId, orderInput);

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
    console.error("order-plan workflow error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
