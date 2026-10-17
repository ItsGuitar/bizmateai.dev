export type SupplierAgentId = "lead" | "receivables" | "procurement" | "financing" | "guard";

export const SUPPLIER_AGENTS: Record<
  SupplierAgentId,
  { name: string; emoji: string; color: string; botAvatar: string }
> = {
  lead: { name: "Lead", emoji: "🧭", color: "#6366F1", botAvatar: "/images/bot10_wave.png" },
  receivables: { name: "Receivables", emoji: "📥", color: "#F97316", botAvatar: "/images/bot01_thumbup.png" },
  procurement: { name: "Procurement", emoji: "📦", color: "#EAB308", botAvatar: "/images/bot04_box_front.png" },
  financing: { name: "Financing", emoji: "🏦", color: "#2563EB", botAvatar: "/images/bot09_run.png" },
  guard: { name: "Policy Guard", emoji: "🛡️", color: "#64748B", botAvatar: "/images/bot06_stand_neutral.png" },
};
