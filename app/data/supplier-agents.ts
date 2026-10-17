export type SupplierAgentId = "lead" | "receivables" | "procurement" | "financing" | "guard";

export const SUPPLIER_AGENTS: Record<SupplierAgentId, { name: string; emoji: string; color: string }> = {
  lead: { name: "Lead", emoji: "🧭", color: "#6366F1" },
  receivables: { name: "Receivables", emoji: "📥", color: "#F97316" },
  procurement: { name: "Procurement", emoji: "📦", color: "#EAB308" },
  financing: { name: "Financing", emoji: "🏦", color: "#2563EB" },
  guard: { name: "Policy Guard", emoji: "🛡️", color: "#64748B" },
};
