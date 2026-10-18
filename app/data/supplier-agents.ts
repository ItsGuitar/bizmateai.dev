export type SupplierAgentId = "lead" | "receivables" | "procurement" | "financing" | "guard";

export const SUPPLIER_AGENTS: Record<SupplierAgentId, { name: string; iconId: SupplierAgentId; color: string }> = {
  lead: { name: "Lead", iconId: "lead", color: "#6366F1" },
  receivables: { name: "Receivables", iconId: "receivables", color: "#F97316" },
  procurement: { name: "Procurement", iconId: "procurement", color: "#EAB308" },
  financing: { name: "Financing", iconId: "financing", color: "#2563EB" },
  guard: { name: "Policy Guard", iconId: "guard", color: "#64748B" },
};
