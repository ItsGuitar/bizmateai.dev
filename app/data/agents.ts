export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  scope: string;
  color: string;
  bgLight: string;
  borderColor: string;
  iconName: string;
  emoji: string;
  autonomyLevel: string;
  consentTrigger: string;
  description: string;
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "health",
    name: "Health Agent",
    role: "Financial Health & Credit Readiness",
    scope: "Evaluates financial health score (0-100), unlocks credit readiness, simulates rating improvements.",
    color: "#1E40AF",
    bgLight: "bg-blue-50/80 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800/60",
    iconName: "ShieldCheck",
    emoji: "🩺",
    autonomyLevel: "Monitors transaction hygiene, calculates 7-factor health score.",
    consentTrigger: "Sharing 'Business Passport' data with external lenders.",
    description: "Evaluates health score (78/100, B+) and certifies trade history with Chen Tech."
  },
  {
    id: "cash",
    name: "Cash Agent",
    role: "13-Week Cash Radar & Stress-Testing",
    scope: "13-week Cash Radar, rolling buffer projections, what-if liquidity stress-testing.",
    color: "#0284C7",
    bgLight: "bg-sky-50/80 dark:bg-sky-950/30",
    borderColor: "border-sky-200 dark:border-sky-800/60",
    iconName: "TrendingUp",
    emoji: "📊",
    autonomyLevel: "Ingests bank and channel feeds; computes daily rolling cash balances.",
    consentTrigger: "Adjusting cash reserve buffer threshold (฿80,000).",
    description: "Predicts ¥100,000 liquidity gap on 26 Oct and warns before dipping below safety buffer."
  },
  {
    id: "funding",
    name: "Funding Agent",
    role: "Working Capital & Supplier Terms",
    scope: "Matches cheapest working capital options, prepares pre-filled applications and supplier terms.",
    color: "#EAB308",
    bgLight: "bg-amber-50/80 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    iconName: "Coins",
    emoji: "💰",
    autonomyLevel: "Evaluates qualifying loan & credit lines against Health Score.",
    consentTrigger: "Submitting loan applications; requesting supplier term extensions.",
    description: "Prepares dual-language 60-day terms negotiation with Shenzhen Chen Tech."
  },
  {
    id: "collections",
    name: "Collections Agent",
    role: "Accounts Receivable & Smart Reminders",
    scope: "Accounts Receivable tracking, payment habit profiling, multi-lingual reminder generation.",
    color: "#EA580C",
    bgLight: "bg-orange-50/80 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800/60",
    iconName: "Receipt",
    emoji: "🔔",
    autonomyLevel: "Identifies overdue invoices, drafts tone-adjusted follow-up messages.",
    consentTrigger: "Sending reminders (LINE / Email); updating invoice status manually.",
    description: "Profiles customer habits (Boutique Siam) and drafts friendly reminders."
  },
  {
    id: "true-cost",
    name: "True Cost Agent",
    role: "APR Calculation & Scam Detection",
    scope: "Validates real APR, cross-border FX corridors, detects fraud/invoice tampering and loan sharks.",
    color: "#B91C1C",
    bgLight: "bg-rose-50/80 dark:bg-rose-950/30",
    borderColor: "border-rose-200 dark:border-rose-800/60",
    iconName: "Calculator",
    emoji: "🔍",
    autonomyLevel: "Unpacks hidden loan/FX fees, verifies recipient account authenticity.",
    consentTrigger: "Routing supplier payment through specific payment rails.",
    description: "Blocks predatory '1% per day' loans and locks verified Shenzhen Chen Tech payee bank details."
  },
  {
    id: "trust",
    name: "Trust Agent",
    role: "Security Gatekeeper & Audit Ledger",
    scope: "Security gatekeeper, PDPA consent manager, audit logger, step-up biometric enforcer.",
    color: "#0F172A",
    bgLight: "bg-slate-50/80 dark:bg-slate-900/40",
    borderColor: "border-slate-300 dark:border-slate-800",
    iconName: "Lock",
    emoji: "🛡️",
    autonomyLevel: "Enforces system rules, logs audit events, blocks prompt injections & scams.",
    consentTrigger: "Loosening auto-reminder rules; granting data access scopes.",
    description: "Guarantees zero unauthorized transfers, biometric step-up, and full immutable audit logs."
  }
];

export const DEMO_PROFILE = {
  companyName: "Ploy Select Co., Ltd.",
  businessModel: "Cross-border Omnichannel MSME",
  channels: ["Shopee", "Lazada", "TikTok Shop", "PromptPay Stall", "LINE OA"],
  supplier: "Shenzhen Chen Tech (Shenzhen, China)",
  referenceDate: "Monday, 12 October 2026, 09:41 AM ICT",
  coreIssue: "Chen Tech Order ¥100,000 due on 26 Oct 2026 vs. ฿80,000 Safety Buffer"
};
