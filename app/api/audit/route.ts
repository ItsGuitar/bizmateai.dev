import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getAuditEntries } from "@/lib/get-audit-entries";

// GET: the real, append-only audit trail for the Trust page.
export async function GET(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const entries = await getAuditEntries(userId);
    return NextResponse.json({ success: true, entries });
  } catch (err: any) {
    console.error("Audit GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
