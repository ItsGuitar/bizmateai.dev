import { NextResponse } from "next/server";
import { getFinancialSummary } from "@/lib/financial-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bankId");
    const summary = getFinancialSummary(bankId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load financial summary:", error);
    return NextResponse.json(
      { error: "Failed to load financial summary from statement dataset" },
      { status: 500 }
    );
  }
}
