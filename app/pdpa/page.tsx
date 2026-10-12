import React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export const metadata = {
  title: "PDPA Privacy & Consent Policy • BizMate",
  description:
    "Comprehensive Personal Data Protection Act (PDPA B.E. 2562) policy, read-only banking scopes, and data governance for BizMate MSME Copilot.",
};

export default function PdpaPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              style={{ fontFamily: "var(--font-logo)" }}
              className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent"
            >
              BizMate
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/register"
              className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
            >
              Back to Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10 sm:py-16">
        {/* Title Section */}
        <div className="mb-10 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-4">
            <span>🛡️ Regulatory Compliance</span>
            <span>•</span>
            <span>Thailand PDPA B.E. 2562 (2019)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Personal Data Protection & Consent Policy
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Effective Date: 12 October 2026 • Version 2.4 (Bank-Grade Security Standard)
          </p>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-2xl mb-2">🔒</div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Strictly Read-Only</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Zero transfer authority. We can never withdraw, transfer funds, or alter your bank credentials.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-2xl mb-2">⚡</div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">1-Tap Revocation</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Revoke any bank, channel, or lender connection anytime directly through the Trust Agent.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-2xl mb-2">🚫</div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Never Sold or Monitized</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your financial records belong to you. We never sell data to advertisers or unauthorized lenders.
            </p>
          </div>
        </div>

        {/* Policy Body */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {/* Section 1 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">1.</span>
              Data Controller Information
            </h3>
            <p>
              This policy governs the processing of personal and business financial data by{" "}
              <strong className="text-slate-900 dark:text-white">BizMate Financial Technologies (Thailand) Co., Ltd.</strong>{" "}
              (&quot;BizMate&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), acting as the Data Controller in accordance with the
              Thailand Personal Data Protection Act B.E. 2562 (PDPA).
            </p>
            <p>
              For inquiries or to exercise your statutory rights, contact our Data Protection Officer (DPO) at{" "}
              <a href="mailto:dpo@bizmate.co" className="text-blue-600 dark:text-blue-400 font-medium underline">
                dpo@bizmate.co
              </a>
              .
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">2.</span>
              Data We Collect &amp; Integration Scopes
            </h3>
            <p>
              To provide the 13-week Cash Radar, Financial Health Score, and automated Accounts Receivable follow-up,
              BizMate requests the following strictly defined data scopes:
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Data Category</th>
                    <th className="p-3">Specific Elements</th>
                    <th className="p-3">Purpose &amp; Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">Commercial Identity</td>
                    <td className="p-3">Company name, Tax ID, authorized representative, work email.</td>
                    <td className="p-3">Account authentication &amp; KYC profile.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">Bank Feeds (Read-Only)</td>
                    <td className="p-3">Account balances, statement lines, 12-month transaction histories.</td>
                    <td className="p-3">Cash Radar forecasting &amp; safety buffer tracking (Cash Agent).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">Omnichannel Sales</td>
                    <td className="p-3">Shopee, Lazada, TikTok Shop payout settlements, PromptPay receipts.</td>
                    <td className="p-3">Inflow projections &amp; credit readiness rating (Health Agent).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">Invoices &amp; AR</td>
                    <td className="p-3">Outstanding buyer invoices, due dates, customer payment timelines.</td>
                    <td className="p-3">Owner-approved reminder drafting (Collections Agent).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">3.</span>
              Zero-Surprise Policy &amp; Negative Scopes
            </h3>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              <strong>Mandatory Technical Safeguard:</strong> BizMate operates under deterministic server-side guardrails
              enforced by the Trust Agent.
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>No Unilateral Transfers:</strong> The system has zero technical capability to initiate, transfer,
                or debit funds without your live physical bank step-up authorization (e.g. Bank App Biometric Face ID).
              </li>
              <li>
                <strong>Approval-First Reminders:</strong> No customer collection messages (LINE OA / Email) are sent
                without owner confirmation in the Central Inbox.
              </li>
              <li>
                <strong>No Undisclosed Credit Applications:</strong> Your Financial Passport is never forwarded to external
                lenders until you explicitly review and approve the specific funding term.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">4.</span>
              Data Storage, Encryption &amp; Security
            </h3>
            <p>
              All personal and commercial transaction data is encrypted in transit using <strong>TLS 1.3</strong> and at rest
              using <strong>AES-256</strong>. Encryption keys are managed through hardware security modules (HSM).
            </p>
            <p>
              Audit records are immutably logged into the Trust Agent ledger, recording exact timestamps of data ingestion,
              agent deliberations, and user approvals.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">5.</span>
              Your Statutory Rights under Thailand PDPA
            </h3>
            <p>Under Sections 30 through 36 of the PDPA, you retain the right to:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <strong>Right to Withdraw Consent:</strong> Revoke any linked bank or sales channel at any moment with 1 tap.
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <strong>Right of Access &amp; Portability:</strong> Request full export of your financial records in machine-readable JSON/CSV.
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <strong>Right to Erasure:</strong> Request permanent deletion of all stored transaction logs upon account termination.
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <strong>Right to Object:</strong> Restrict automated processing or profiling for credit score simulations.
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">6.</span>
              Consent Duration &amp; Revocation Mechanism
            </h3>
            <p>
              Your initial consent is valid for a period of <strong>12 months</strong> from the date of agreement. You may
              inspect active authorizations and terminate access at any time via:
            </p>
            <p className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 font-mono text-xs text-blue-600 dark:text-blue-400">
              BizMate Dashboard → Trust Agent Security Controls → Tab 2: Sharing &amp; Consents → Tap [Revoke Access]
            </p>
          </section>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            By registering for BizMate, you consent to data processing under these terms.
          </p>
          <Link
            href="/register"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all text-center"
          >
            I Understand &amp; Return to Register →
          </Link>
        </div>
      </main>
    </div>
  );
}
