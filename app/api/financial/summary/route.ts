import { NextResponse } from "next/server";
import { getFinancialSummary, getMultiBankFinancialSummary } from "@/lib/financial-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bankId");
    const bankIdsParam = searchParams.get("bankIds");

    let bankIds: string[] = [];
    if (bankIdsParam) {
      bankIds = bankIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (bankId) {
      bankIds = bankId.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (bankIds.length > 1) {
      const summary = getMultiBankFinancialSummary(bankIds);
      return NextResponse.json(summary);
    }

    const singleBankId = bankIds[0] || undefined;
    const summary = getFinancialSummary(singleBankId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load financial summary:", error);
    return NextResponse.json(
      { error: "Failed to load financial summary from statement dataset" },
      { status: 500 }
    );
  }
}
