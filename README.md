# BizMate AI (bizmateai.dev)

AI-Powered Multi-Agent Financial Copilot and Working Capital Intelligence for SMEs and Suppliers.

BizMate AI (bizmateai.dev) is an enterprise-grade financial management platform designed for SMEs and suppliers. It ingests financial documents (invoices, purchase orders, receipts, bank statements), runs a deterministic 7-stage calculation pipeline, tracks working capital, forecasts cash flow over 13-26 weeks, and coordinates specialized AI agents with strict security guardrails.

---

## Core System Architecture

### 1. Deterministic Calculation Pipeline
Financial math and ledger balances are strictly computed via deterministic code rather than AI generation:
- Stage 1: Document Ingestion, deduplication, counterparty normalization, and SHA-256 verification.
- Stage 2: Buyer Payment Modeling using credibility shrinkage, confidence intervals, and letter grades (A, B, C, D).
- Stage 3: Weekly Cash Flow Forecast across 13 to 26 weeks with cushion breach warnings and scenario modeling.
- Stage 4: Health Scoring (100-point composite score) with Factory Level visualization (Levels 1 to 5).
- Stage 5: Issue Ranking based on financial impact and urgency.
- Stage 6: Financing Need analysis matching non-predatory lender products.
- Stage 7: Unified state sync across all dashboard views.

### 2. Multi-Agent System
Specialized agents collaborate to advise the business owner:
- Lead Agent: High-level financial status orchestration and executive summaries.
- Receivables Agent: Invoicing timelines, buyer payment reliability, and reminder drafting.
- Procurement Agent: Material price volatility tracking (e.g. cold-rolled steel, copper, polypropylene) and procurement scheduling.
- Financing Agent: Non-predatory loan matching and cash flow repayment simulations.
- Policy Guard: Safety policy enforcement and compliance boundaries.

### 3. Agent Room and Human-in-the-Loop Inbox
- Agent Room: A glass-box execution replay showing each agent's reasoning, data checks, and proposed interventions step by step.
- Inbox Approvals: Agents operate under strict delegation tiers. No external messages, loan requests, or commitments are executed automatically. Sensitive actions require owner approval in the Inbox, with biometric/Face ID confirmation for high-risk operations.

### 4. Working Capital and Operational Modules
- Home Dashboard: Live Health Score, Cash Radar, runway status, and ranked issues.
- Data and Document Ingestion: OCR scanning for tax invoices, POs, and receipts with client-side data masking and audit hashing.
- New Order Evaluator: Real-time risk analysis for incoming orders against current cash and material price sensitivity.
- Receivables and Buyer Grading: Aging buckets, overdue tracking, and AI-worded payment reminder drafting in multiple languages (English, Thai, Chinese).
- Procurement and Price Trends: Raw material cost forecasting and margin stress tests.
- Financing: Pre-matched working capital loans and invoice factoring with repayment viability checks.
- Trust and Compliance: Tamper-evident audit trail with SHA-256 hash chains, Merkle root verification, and four-tier autonomy controls.
- Mock Document Generator: Testing tool for generating realistic multi-language commercial documents with configurable noise and layout variations to benchmark AI extraction accuracy.

---

## Security and Compliance Controls

BizMate AI implements a 4-tier autonomy governance model:
- Tier 0 (Read and Analyze): Agents analyze data autonomously (forecasting, buyer scoring, scenario calculation).
- Tier 1 (Draft): Agents prepare drafts internally; nothing leaves the system (drafting reminders, compiling credit applications).
- Tier 2 (Send or Commit): Requires explicit business owner approval through the Inbox.
- Tier 3 (Move Money or Sign Contracts): Strictly blocked in code; no execution tools or API endpoints exist for autonomous fund transfers.

Additional protections:
- Data Masking: Personally Identifiable Information (PII) including names, tax IDs, bank accounts, and contact details are tokenized before communicating with external AI models.
- Cryptographic Audit Trail: Every critical user action, document import, and agent proposal is sealed into a SHA-256 hash chain with Merkle root computation.

---

## Technology Stack

- Framework: Next.js (App Router, Turbopack)
- Language: TypeScript, React 19
- Styling: Tailwind CSS v4
- Database and ORM: PostgreSQL (Supabase) with Prisma ORM
- AI Engine: Google Gemini API via @google/generative-ai (Gemini 2.5 Flash / Flash Lite)
- Document Processing: pdfjs-dist, pdf2json, jspdf, html2canvas, xlsx
- Authentication: JWT tokens and bcryptjs password hashing

---

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or pnpm
- PostgreSQL database (or Supabase instance)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/ItsGuitar/bizmateai.dev.git
   cd bizmate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Variables:
   Create a `.env` file in the project root:
   ```env
   # PostgreSQL database connection
   DATABASE_URL="postgresql://username:password@host:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://username:password@host:5432/postgres"

   # Authentication
   JWT_SECRET="your-secure-jwt-secret-key"

   # Google Gemini API Key
   GEMINI_API_KEY="your-gemini-api-key"
   ```

4. Database Migration:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Run Development Server:
   ```bash
   npm run dev
   ```

6. Access the application at `http://localhost:3000`.

---

## Repository Structure

```
bizmate/
├── app/
│   ├── account/              # User profile and account settings
│   ├── admin/                # System telemetry and administration
│   ├── api/                  # API routes (AI, Auth, Documents, Ingest, Workflow, Inbox)
│   ├── components/           # Shared UI components, icons, navigation, and onboarding tour
│   ├── dashboard/            # Platform modules
│   │   ├── agent-room/       # Multi-agent glass-box deliberation replay
│   │   ├── data/             # Document ingestion and verification
│   │   ├── financing/        # Lender matching and repayment simulation
│   │   ├── generator/        # Synthetic document generator and OCR benchmark
│   │   ├── inbox/            # Human-in-the-loop approval cards
│   │   ├── new-order/        # Order feasibility and margin sensitivity check
│   │   ├── procurement/      # Material price tracking and procurement planning
│   │   ├── receivables/      # Buyer payment grading and debt collection
│   │   └── trust/            # Tamper-evident audit chain and governance checks
│   ├── docs/                 # Built-in visual user guide
│   ├── login/                # Authentication login
│   ├── onboarding/           # Business profile onboarding
│   └── register/             # User registration
├── lib/
│   ├── ai/                   # Gemini client, guardrails, token masking, and call logs
│   ├── audit-chain.ts        # SHA-256 hash chaining and Merkle root verification
│   ├── calculation-pipeline.ts # 7-stage deterministic financial engine
│   ├── financing-engine.ts   # Working capital loan matching and repayment models
│   ├── order-engine.ts       # Buyer behavior statistics and material pricing models
│   ├── prisma.ts             # Prisma client singleton
│   └── workflow-engine.ts    # Multi-agent workflow runner and state machines
├── prisma/
│   └── schema.prisma         # Database schema definition
└── public/                   # Static assets, bank logos, visualization sprites
```

---

## Author

Its-Guitar
- GitHub: https://github.com/Its-Guitar
- Email: guitar999mc@gmail.com
