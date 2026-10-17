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
    id: "lead",
    name: "Lead",
    role: "Orchestrator & Daily Brief",
    tagline: "Ranks issues, tracks factory health, runs the cash forecast",
    badge: "Daily Brief",
    color: "#6366F1",
    lightBg: "from-indigo-500/10 to-slate-500/5",
    ringColor: "border-indigo-500/30 group-hover:border-indigo-500",
    glowGradient: "from-indigo-600/20 to-slate-600/10",
    emoji: "🧭",
    avatarSeed: "lead",
    highlightStat: "13 Weeks",
    statLabel: "Rolling Horizon",
    description: "Pulls every signal together each morning: ranked issues, factory health and level, and a rolling cash curve so you know exactly what needs your approval first.",
    route: "/dashboard",
  },
  {
    id: "receivables",
    name: "Receivables",
    role: "Smart Collections",
    tagline: "Buyer payment habits & tone-adjusted chase schedules",
    badge: "Zero-Surprise OK",
    color: "#F97316",
    lightBg: "from-orange-500/10 to-amber-500/5",
    ringColor: "border-orange-500/30 group-hover:border-orange-500",
    glowGradient: "from-orange-600/20 to-amber-600/10",
    emoji: "📥",
    avatarSeed: "receivables",
    highlightStat: "5 Steps",
    statLabel: "Chase Schedule",
    description: "Profiles how long each buyer really takes to pay, predicts delay risk, and drafts polite bilingual reminders that wait for your approval before anything is sent.",
    route: "/dashboard/receivables",
  },
  {
    id: "procurement",
    name: "Procurement",
    role: "Material Planning",
    tagline: "Buy-lot timing and price calls before you commit cash",
    badge: "Cost Optimization",
    color: "#EAB308",
    lightBg: "from-amber-500/10 to-yellow-500/5",
    ringColor: "border-amber-500/30 group-hover:border-amber-500",
    glowGradient: "from-amber-600/20 to-yellow-600/10",
    emoji: "📦",
    avatarSeed: "procurement",
    highlightStat: "Lock / Split / Finance",
    statLabel: "Buy Decision",
    description: "Plans material buys for upcoming orders: price range, lot size, and whether to lock, split, collect, or finance the purchase.",
    route: "/dashboard/procurement",
  },
  {
    id: "financing",
    name: "Financing",
    role: "Working Capital & Credit",
    tagline: "Cheapest capital matching with a true APR shield",
    badge: "Zero Predatory Traps",
    color: "#2563EB",
    lightBg: "from-blue-500/10 to-indigo-500/5",
    ringColor: "border-blue-500/30 group-hover:border-blue-500",
    glowGradient: "from-blue-600/20 to-indigo-600/10",
    emoji: "🏦",
    avatarSeed: "financing",
    highlightStat: "True APR",
    statLabel: "Rate Shield",
    description: "Matches your financing need to the cheapest product across banks and platforms, checks repayment fit, and negotiates in a sandbox before you ever sign.",
    route: "/dashboard/financing",
  },
];

// Compatibility export
export const AGENTS = MODULE_CAPABILITIES;
