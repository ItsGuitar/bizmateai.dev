import { NextResponse } from "next/server";
import { getTransactions, REFERENCE_DATE_ISO } from "@/lib/financial-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const channel = searchParams.get("channel");
    const category = searchParams.get("category");
    const scope = searchParams.get("scope"); // "past" | "future" | "all"

    const bankId = searchParams.get("bankId") || undefined;
    const bankIdsParam = searchParams.get("bankIds");

    let bankIds: string[] = [];
    if (bankIdsParam) {
      bankIds = bankIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (bankId) {
      bankIds = bankId.split(",").map((s) => s.trim()).filter(Boolean);
    }

    let txns: ReturnType<typeof getTransactions> = [];
    if (bankIds.length > 1) {
      const allTxns = bankIds.flatMap((b) => getTransactions(b));
      // Sort combined transactions descending by datetime
      allTxns.sort((a, b) => (b.datetime > a.datetime ? 1 : b.datetime < a.datetime ? -1 : 0));
      txns = allTxns;
    } else {
      txns = getTransactions(bankIds[0] || undefined);
    }

    if (scope === "past") {
      txns = txns.filter((t) => t.datetime <= REFERENCE_DATE_ISO);
    } else if (scope === "future") {
      txns = txns.filter((t) => t.datetime > REFERENCE_DATE_ISO);
    }

    if (channel) {
      txns = txns.filter((t) => t.channel.toLowerCase().includes(channel.toLowerCase()));
    }

    if (category) {
      txns = txns.filter((t) => t.category.toLowerCase().includes(category.toLowerCase()));
    }

    const total = txns.length;
    const paginated = txns.slice(offset, offset + limit);

    return NextResponse.json({
      total,
      limit,
      offset,
      transactions: paginated,
    });
  } catch (error) {
    console.error("Failed to fetch statement transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch statement transactions" },
      { status: 500 }
    );
  }
}
