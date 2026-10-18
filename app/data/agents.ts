export interface ModuleCapability {
  id: string;
  name: string;
  role: string;
  tagline: string;
  badge: string;
  color: string;
  ringColor: string;
  iconId: "lead" | "receivables" | "procurement" | "financing" | "guard";
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
    ringColor: "border-indigo-200 dark:border-indigo-800 group-hover:border-indigo-500",
    iconId: "lead",
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
    ringColor: "border-orange-200 dark:border-orange-800 group-hover:border-orange-500",
    iconId: "receivables",
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
    ringColor: "border-amber-200 dark:border-amber-800 group-hover:border-amber-500",
    iconId: "procurement",
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
    ringColor: "border-blue-200 dark:border-blue-800 group-hover:border-blue-500",
    iconId: "financing",
    avatarSeed: "financing",
    highlightStat: "True APR",
    statLabel: "Rate Shield",
    description: "Matches your financing need to the cheapest product across banks and platforms, checks repayment fit, and negotiates in a sandbox before you ever sign.",
    route: "/dashboard/financing",
  },
];

// Compatibility export
export const AGENTS = MODULE_CAPABILITIES;
