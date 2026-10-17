export interface ModuleCapability {
  id: string;
  name: string;
  role: string;
  tagline: string;
  badge: string;
  color: string;
  lightBg: string;
  ringColor: string;
  glowGradient: string;
  emoji: string;
  botImage?: string;
  avatarSeed: string;
  highlightStat: string;
  statLabel: string;
  description: string;
  route: string;
}

// Backwards-compatibility alias
export type AgentDefinition = ModuleCapability;

export const MODULE_CAPABILITIES: ModuleCapability[] = [
  {
    id: "radar",
    name: "Cash Radar",
    role: "Liquidity Forecasting",
    tagline: "13-Week rolling liquidity & what-if stress tests",
    badge: "Live Telemetry",
    color: "#2563EB",
    lightBg: "from-blue-500/10 to-indigo-500/5",
    ringColor: "border-blue-500/30 group-hover:border-blue-500",
    glowGradient: "from-blue-600/20 to-indigo-600/10",
    emoji: "📊",
    botImage: "/images/bot10_wave.png",
    avatarSeed: "radar",
    highlightStat: "13 Weeks",
    statLabel: "Rolling Horizon",
    description: "Evaluates multi-bank balances, projects weekly net cash curves, and models custom Inflow/Outflow what-if scenarios to spot breaches before they happen.",
    route: "/dashboard",
  },
  {
    id: "smart-data",
    name: "Data Hub & Ingest",
    role: "Universal Ingestion",
    tagline: "Multi-bank aggregator, Excel reasoning & Vision OCR",
    badge: "Zero OCR Cost",
    color: "#0284C7",
    lightBg: "from-sky-500/10 to-cyan-500/5",
    ringColor: "border-sky-500/30 group-hover:border-sky-500",
    glowGradient: "from-sky-600/20 to-cyan-600/10",
    emoji: "📁",
    botImage: "/images/bot08_tablet.png",
    avatarSeed: "data",
    highlightStat: "100% Digital",
    statLabel: "Native Parsing",
    description: "Connects KBank, SCB, BBL accounts, parses digital PDFs and spreadsheets directly with zero OCR token waste, and provides client-side redaction for scanned image OCR.",
    route: "/dashboard/data",
  },
  {
    id: "new-order",
    name: "Order Evaluator",
    role: "Profitability & Feasibility",
    tagline: "Stress-test customer orders before committing cash",
    badge: "Margin Guard",
    color: "#10B981",
    lightBg: "from-emerald-500/10 to-teal-500/5",
    ringColor: "border-emerald-500/30 group-hover:border-emerald-500",
    glowGradient: "from-emerald-600/20 to-teal-600/10",
    emoji: "⚡",
    botImage: "/images/bot01_thumbup.png",
    avatarSeed: "order",
    highlightStat: "Real-time",
    statLabel: "Gap Detection",
    description: "Simulates working capital requirements, bill of materials lead times, and upfront material costs to calculate exact feasibility before accepting large purchase orders.",
    route: "/dashboard/new-order",
  },
  {
    id: "receivables",
    name: "Receivables Hub",
    role: "Smart Collections",
    tagline: "Debtor habit profiling & tone-adjusted reminders",
    badge: "Zero-Surprise OK",
    color: "#F97316",
    lightBg: "from-orange-500/10 to-amber-500/5",
    ringColor: "border-orange-500/30 group-hover:border-orange-500",
    glowGradient: "from-orange-600/20 to-amber-600/10",
    emoji: "📥",
    botImage: "/images/bot06_stand_neutral.png",
    avatarSeed: "receivables",
    highlightStat: "Adaptive",
    statLabel: "Payment Profiling",
    description: "Profiles debtor payment behaviors (e.g. Shenzhen ElectroParts), predicts delay probabilities, and drafts polite bilingual follow-ups that require owner approval.",
    route: "/dashboard/receivables",
  },
  {
    id: "procurement",
    name: "Procurement Intel",
    role: "Supplier Terms & Costs",
    tagline: "Material price trends & supplier payment optimization",
    badge: "Cost Optimization",
    color: "#EAB308",
    lightBg: "from-amber-500/10 to-yellow-500/5",
    ringColor: "border-amber-500/30 group-hover:border-amber-500",
    glowGradient: "from-amber-600/20 to-yellow-600/10",
    emoji: "📦",
    botImage: "/images/bot04_box_front.png",
    avatarSeed: "procurement",
    highlightStat: "Market Sync",
    statLabel: "Material Tracking",
    description: "Monitors raw material market indices, audits supplier invoices, and negotiates staggered payment schedules to preserve factory working capital.",
    route: "/dashboard/procurement",
  },
  {
    id: "financing",
    name: "Financing Matching",
    role: "Working Capital & Credit",
    tagline: "Cheapest capital matching & true APR calculation",
    badge: "Zero Predatory Traps",
    color: "#8B5CF6",
    lightBg: "from-violet-500/10 to-purple-500/5",
    ringColor: "border-violet-500/30 group-hover:border-violet-500",
    glowGradient: "from-violet-600/20 to-purple-600/10",
    emoji: "🏦",
    botImage: "/images/bot03_celebrate.png",
    avatarSeed: "financing",
    highlightStat: "Cheapest Path",
    statLabel: "True APR Shield",
    description: "Computes effective annualized APR across invoice factoring, supplier credit, and pre-approved bank loans to protect businesses from expensive liquidity traps.",
    route: "/dashboard/financing",
  },
  {
    id: "trust",
    name: "Trust & Governance",
    role: "Bank-Grade Guardrails",
    tagline: "Biometric step-up, immutable audit trail & PDPA",
    badge: "Deterministic",
    color: "#6366F1",
    lightBg: "from-indigo-500/10 to-slate-500/5",
    ringColor: "border-indigo-500/30 group-hover:border-indigo-500",
    glowGradient: "from-indigo-600/20 to-slate-600/10",
    emoji: "🛡️",
    botImage: "/images/bot02_sit.png",
    avatarSeed: "trust",
    highlightStat: "Read-Only",
    statLabel: "12-Mo Telemetry",
    description: "Enforces Thailand PDPA read-only banking connections, zero autonomous fund disbursements without biometric authorization, and cryptographically verified audit trails.",
    route: "/dashboard/trust",
  },
  {
    id: "generator",
    name: "Doc Studio",
    role: "Financial Testbeds",
    tagline: "Mock statement generation & stress-test sandboxes",
    badge: "Sandbox Mode",
    color: "#EC4899",
    lightBg: "from-pink-500/10 to-rose-500/5",
    ringColor: "border-pink-500/30 group-hover:border-pink-500",
    glowGradient: "from-pink-600/20 to-rose-600/10",
    emoji: "📝",
    botImage: "/images/bot05_box_side.png",
    avatarSeed: "generator",
    highlightStat: "Instant",
    statLabel: "Mock Testbed",
    description: "Generates realistic mock 365-day multi-currency statements, invoices, and purchase orders for safe evaluation and scenario benchmarking.",
    route: "/dashboard/generator",
  },
];

// Compatibility export
export const AGENTS = MODULE_CAPABILITIES;
