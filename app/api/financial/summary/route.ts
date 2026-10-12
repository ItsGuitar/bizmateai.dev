import { NextResponse } from "next/server";
import { getFinancialSummary } from "@/lib/financial-service";

export async function GET() {
  try {
    const summary = getFinancialSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load financial summary:", error);
    return NextResponse.json(
      { error: "Failed to load financial summary from statement dataset" },
      { status: 500 }
    );
  }
}
