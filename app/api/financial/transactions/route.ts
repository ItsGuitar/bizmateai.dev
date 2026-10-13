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

    let txns = getTransactions(bankId);

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
