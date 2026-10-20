import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getAuditEntries } from "@/lib/get-audit-entries";
import { GENESIS_HASH, computeChain, merkleRootOf, dailyMerkleRoots } from "@/lib/audit-chain";

// GET: the downloadable sandbox_operation_logs.json evidence file for the Trust page's Export
// button. Server-side so the date and hash chain are always computed fresh, never hardcoded.
export async function GET(req: Request) {
  try {
    const userId = requireUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const entries = await getAuditEntries(userId);
    const hashes = await computeChain(entries);
    const overallMerkleRoot = await merkleRootOf(hashes);
    const perDay = await dailyMerkleRoots(entries, hashes);

    const payload = {
      type: "sandbox_operation_logs",
      product: "BizMateAI SME Finance Copilot",
      generatedAt: new Date().toISOString(),
      chain: {
        algorithm: "SHA-256",
        genesisHash: GENESIS_HASH,
        canonicalFields: ["seq", "ts", "actor", "action", "detail", "tier", "approval", "prevHash"],
      },
      entries: entries.map((entry, i) => ({
        ...entry,
        prevHash: i === 0 ? GENESIS_HASH : hashes[i - 1],
        hash: hashes[i],
      })),
      dailyMerkleRoots: perDay,
      overallMerkleRoot,
      anchoring: {
        status: "simulated",
        network: "FISCO BCOS (consortium chain)",
        note: "This submission does not broadcast to a live chain. The Trust page's 'Simulate FISCO BCOS anchor' action shows what anchoring the overall Merkle root would look like.",
      },
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="sandbox_operation_logs.json"',
      },
    });
  } catch (err: any) {
    console.error("Audit export GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
