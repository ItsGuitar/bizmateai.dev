// Mock dataset for the Trust page. NEW_DESIGN.md Section 8 (Security and compliance): tiers,
// required controls, tamper-evident audit log, masking, security self-assessment.

export interface TierRule {
  tier: 0 | 1 | 2 | 3;
  action: string;
  rule: string;
  examples: string[];
}

export const TIER_RULES: TierRule[] = [
  {
    tier: 0,
    action: "Read and analyse",
    rule: "Agents act alone",
    examples: ["Forecast", "Score buyers", "Match lenders", "Run scenarios"],
  },
  {
    tier: 1,
    action: "Draft",
    rule: "Agents act alone; nothing leaves the system",
    examples: ["Draft reminders", "Fill forms", "Build the credit package", "Sandbox negotiation"],
  },
  {
    tier: 2,
    action: "Send or commit",
    rule: "You approve each one",
    examples: ["Send a reminder", "Post a financing demand", "Share documents", "Accept an offer or order"],
  },
  {
    tier: 3,
    action: "Move money or sign",
    rule: "Blocked in code, no tool exists",
    examples: ["Pay", "Transfer", "Sign a contract", "Sign credit-check consent", "Change bank details"],
  },
];

export interface SelfAssessmentRow {
  risk: string;
  control: string;
  leftToDo: string;
}

export const SELF_ASSESSMENT: SelfAssessmentRow[] = [
  { risk: "AI moves money or signs", control: "Tier 3 blocked in code; no payment or signing tool", leftToDo: "Bank-side limits on live APIs" },
  { risk: "AI acts without the owner", control: "Approval cards; mandate checked in code", leftToDo: "Two-person approval above a threshold" },
  { risk: "Sensitive data sent to the model", control: "Masking adapter; numbers computed in code", leftToDo: "Image redaction is manual" },
  { risk: "Wrong numbers from the model", control: "All money math is deterministic and tested", leftToDo: "Back-test forecasts on real data" },
  { risk: "Prompt injection from files", control: "Data-only handling; read-only tools", leftToDo: "Scanner for hidden instructions" },
  { risk: "Bad or partial data", control: "Owner-confirmed mapping; row notes; confidence drops", leftToDo: "Cross-source duplicate detection" },
  { risk: "Log tampering", control: "Hash chain + daily Merkle root; export; simulated FISCO BCOS anchor", leftToDo: "Real (non-simulated) third-party anchoring" },
  { risk: "Wrong lender terms", control: "Rates labelled illustrative", leftToDo: "Live product feed" },
];

// What the owner sees vs. the masked payload the AI model actually receives. Names, IDs, bank
// accounts, phones and emails are tokenised before any call; amounts are not masked (the model
// needs them to reason). The mapping table never leaves BizMate's own database.
export const MASKING_DEMO = {
  callLabel: "Draft a reminder for Shenzhen ElectroParts",
  sentAt: "17 Oct 2026, 08:03",
  mapping: [
    { field: "Company", real: "Shenzhen Dragon Precision Manufacturing Co., Ltd.", token: "Company_X" },
    { field: "Buyer", real: "Shenzhen ElectroParts", token: "Buyer_A" },
    { field: "Contact", real: "Li Wei", token: "Person_A1" },
    { field: "Tax ID", real: "91440300MA5XXXXX1Q", token: "TAXID_001" },
    { field: "Bank account", real: "6222 0212 3456 7890", token: "ACCOUNT_001" },
    { field: "Phone", real: "+86 138 0013 8000", token: "PHONE_001" },
    { field: "Email", real: "li.wei@shenzhenelectroparts.cn", token: "EMAIL_001" },
  ],
  lastPayload: {
    task: "draft_reminder",
    buyer: "Buyer_A",
    contact: "Person_A1",
    invoice_no: "INV-2026-0914",
    amount: 86000,
    overdue_days: 21,
    tone: "firm",
    language: "English",
  },
};

export interface AuditEntrySeed {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  detail: string;
  tier: 0 | 1 | 2 | 3;
  approval: string | null;
}

export const AUDIT_ENTRIES_SEED: AuditEntrySeed[] = [
  { seq: 1, ts: "2026-10-17T06:00:00Z", actor: "lead", action: "forecast_run", detail: "Recomputed the 26-week cash forecast and health score", tier: 0, approval: null },
  { seq: 2, ts: "2026-10-17T08:02:00Z", actor: "receivables", action: "list_overdue", detail: "Scanned open invoices; flagged Shenzhen ElectroParts and Chiang Mai Furniture overdue", tier: 0, approval: null },
  { seq: 3, ts: "2026-10-17T08:03:00Z", actor: "receivables", action: "draft_reminder", detail: "Drafted a firm reminder for Shenzhen ElectroParts, step 3 of 5", tier: 1, approval: null },
  { seq: 4, ts: "2026-10-17T08:05:00Z", actor: "guard", action: "guard_check", detail: "Checked the draft for prohibited language: passed", tier: 1, approval: null },
  { seq: 5, ts: "2026-10-17T08:10:00Z", actor: "owner", action: "approve", detail: "Approved: send reminder to Shenzhen ElectroParts", tier: 2, approval: "appr-chase-1" },
  { seq: 6, ts: "2026-10-17T08:10:05Z", actor: "receivables", action: "send_reminder", detail: "Sent the reminder to Shenzhen ElectroParts via LINE and email", tier: 2, approval: "appr-chase-1" },
  { seq: 7, ts: "2026-10-17T09:40:00Z", actor: "financing", action: "match_lenders", detail: "Matched 7 lender products against the Guangzhou Motors cash gap", tier: 0, approval: null },
  { seq: 8, ts: "2026-10-17T09:45:00Z", actor: "financing", action: "negotiate", detail: "Ran a sandbox negotiation for the government-guaranteed loan", tier: 1, approval: null },
  { seq: 9, ts: "2026-10-17T09:50:00Z", actor: "owner", action: "decline", detail: "Declined: negotiated offer from WeBank Weiyedai", tier: 2, approval: "appr-nego-1" },
  { seq: 10, ts: "2026-10-17T14:02:00Z", actor: "procurement", action: "lock_price", detail: "Locked November cold-rolled steel at ¥4,482 a tonne", tier: 0, approval: null },
];
