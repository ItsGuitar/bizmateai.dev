export interface AgentDefinition {
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
  avatarSeed: string;
  highlightStat: string;
  statLabel: string;
  description: string;
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "health",
    name: "Health Agent",
    role: "Financial Health",
    tagline: "Credit readiness & 7-factor hygiene",
    badge: "Grade B+",
    color: "#2563EB",
    lightBg: "from-blue-500/10 to-indigo-500/5",
    ringColor: "border-blue-500/30 group-hover:border-blue-500",
    glowGradient: "from-blue-600/20 to-indigo-600/10",
    emoji: "🩺",
    avatarSeed: "health",
    highlightStat: "78 / 100",
    statLabel: "Health Score",
    description: "Evaluates financial hygiene across 7 factors, unlocks pre-qualified bank credit tiers, and certifies Shenzhen Chen Tech trade history."
  },
  {
    id: "cash",
    name: "Cash Agent",
    role: "13-Week Radar",
    tagline: "Rolling liquidity & safety buffer",
    badge: "Radar Live",
    color: "#0284C7",
    lightBg: "from-sky-500/10 to-cyan-500/5",
    ringColor: "border-sky-500/30 group-hover:border-sky-500",
    glowGradient: "from-sky-600/20 to-cyan-600/10",
    emoji: "📊",
    avatarSeed: "cash",
    highlightStat: "฿80,000",
    statLabel: "Safety Buffer",
    description: "Ingests daily bank and multichannel sales feeds to map rolling cash flow. Simulates what-if stress tests before buffer breaches."
  },
  {
    id: "funding",
    name: "Funding Agent",
    role: "Capital & Terms",
    tagline: "Cheapest working capital matching",
    badge: "1.1% Rate",
    color: "#EAB308",
    lightBg: "from-amber-500/10 to-yellow-500/5",
    ringColor: "border-amber-500/30 group-hover:border-amber-500",
    glowGradient: "from-amber-600/20 to-yellow-600/10",
    emoji: "💰",
    avatarSeed: "funding",
    highlightStat: "60 Days",
    statLabel: "Terms Match",
    description: "Ranks capital paths by effective APR. Drafts bilingual 60-day deferred export payment proposals directly for Chinese suppliers."
  },
  {
    id: "collections",
    name: "Collections Agent",
    role: "Smart AR",
    tagline: "Polite receivables & habit profiling",
    badge: "Automated",
    color: "#F97316",
    lightBg: "from-orange-500/10 to-amber-500/5",
    ringColor: "border-orange-500/30 group-hover:border-orange-500",
    glowGradient: "from-orange-600/20 to-amber-600/10",
    emoji: "🔔",
    avatarSeed: "collections",
    highlightStat: "฿35,000",
    statLabel: "Pending Recovery",
    description: "Profiles debtor payment timing (e.g. Boutique Siam). Generates tone-adjusted LINE & email follow-ups with owner OK required."
  },
  {
    id: "true-cost",
    name: "True Cost Agent",
    role: "APR & Fraud Shield",
    tagline: "Hidden FX fees & predatory loan detection",
    badge: "Protected",
    color: "#EF4444",
    lightBg: "from-rose-500/10 to-red-500/5",
    ringColor: "border-rose-500/30 group-hover:border-rose-500",
    glowGradient: "from-rose-600/20 to-red-600/10",
    emoji: "🔍",
    avatarSeed: "truecost",
    highlightStat: "0% Traps",
    statLabel: "Scam Defense",
    description: "Computes effective annualized APR on all financing ads (blocking predatory 365%/yr loans) and locks verified supplier payment rails."
  },
  {
    id: "trust",
    name: "Trust Agent",
    role: "Security Gatekeeper",
    tagline: "PDPA consents & immutable audit ledger",
    badge: "Enforced",
    color: "#6366F1",
    lightBg: "from-indigo-500/10 to-violet-500/5",
    ringColor: "border-indigo-500/30 group-hover:border-indigo-500",
    glowGradient: "from-indigo-600/20 to-violet-600/10",
    emoji: "🛡️",
    avatarSeed: "trust",
    highlightStat: "Biometric",
    statLabel: "Step-Up Lock",
    description: "Guarantees deterministic server guardrails. Enforces zero unauthorized disbursements and logs every action to an immutable audit trail."
  }
];
