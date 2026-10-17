import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { BUSINESS_TYPES } from "@/app/data/business-types";
import { SALES_CHANNELS } from "@/app/data/sales-channels";

export async function GET(request: Request) {
  const tokenPayload = getUserFromRequest(request);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: tokenPayload.userId },
  });

  return NextResponse.json({ profile });
}

export async function DELETE(request: Request) {
  const tokenPayload = getUserFromRequest(request);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = tokenPayload;

  await prisma.$transaction([
    prisma.businessProfile.deleteMany({ where: { userId } }),
    prisma.whatIfScenario.deleteMany({ where: { userId } }),
    prisma.inboxApproval.deleteMany({ where: { userId } }),
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.userBankConnection.deleteMany({ where: { userId } }),
    prisma.chatSession.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const tokenPayload = getUserFromRequest(request);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    businessName,
    juristicId,
    businessType,
    tradingSince,
    whatYouSell,
    whereYouSell,
    mainSupplierCountry,
    monthlySalesRange,
  } = body ?? {};

  const cleanName = typeof businessName === "string" ? businessName.trim() : "";
  if (!cleanName) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }

  if (businessType && !BUSINESS_TYPES.includes(businessType)) {
    return NextResponse.json({ error: "Invalid business type." }, { status: 400 });
  }

  if (juristicId && !/^\d{13}$/.test(String(juristicId).trim())) {
    return NextResponse.json({ error: "Juristic ID must be exactly 13 digits." }, { status: 400 });
  }

  const cleanChannels = Array.isArray(whereYouSell)
    ? whereYouSell.filter((c: unknown) => typeof c === "string" && SALES_CHANNELS.includes(c))
    : [];

  const cleanTradingSince =
    typeof tradingSince === "number" && Number.isFinite(tradingSince) ? Math.trunc(tradingSince) : null;

  const profile = await prisma.businessProfile.upsert({
    where: { userId: tokenPayload.userId },
    update: {
      businessName: cleanName,
      juristicId: juristicId ? String(juristicId).trim() : null,
      businessType: businessType || null,
      tradingSince: cleanTradingSince,
      whatYouSell: typeof whatYouSell === "string" ? whatYouSell.trim() : null,
      whereYouSell: cleanChannels,
      mainSupplierCountry: typeof mainSupplierCountry === "string" ? mainSupplierCountry.trim() : null,
      monthlySalesRange: monthlySalesRange || null,
    },
    create: {
      userId: tokenPayload.userId,
      businessName: cleanName,
      juristicId: juristicId ? String(juristicId).trim() : null,
      businessType: businessType || null,
      tradingSince: cleanTradingSince,
      whatYouSell: typeof whatYouSell === "string" ? whatYouSell.trim() : null,
      whereYouSell: cleanChannels,
      mainSupplierCountry: typeof mainSupplierCountry === "string" ? mainSupplierCountry.trim() : null,
      monthlySalesRange: monthlySalesRange || null,
    },
  });

  // Keep User.businessName in sync so headers/greetings stay accurate.
  await prisma.user.update({
    where: { id: tokenPayload.userId },
    data: { businessName: cleanName },
  });

  return NextResponse.json({ profile });
}
