# BizMate (SME Finance Copilot)

> **AI-Powered Multi-Agent Financial Copilot & Working Capital Intelligence for SMEs**

BizMate is an enterprise-grade AI financial management and operational copilot designed specifically for SMEs and suppliers. It ingests financial documents (invoices, purchase orders, bank statements), runs audit-grade calculation pipelines, tracks working capital, forecasts cash flow, and orchestrates specialized AI agents to help business owners make confident decisions.

---

## 🌟 Key Features

### 1. 📊 Real-Time Financial Health & Cash Radar
- **Live Health Score**: Multi-factor health scoring computed from uploaded verified documents.
- **Factory Visualization**: Gamified visual indicator representing your company's operational and cash health status in real time.
- **Cash Flow Radar & Gap Detection**: Forward-looking projection of working capital and cash deficits.

### 2. 🤖 Multi-Agent Financial Team & Agent Room
- **Agent Orchestration**: Specialized AI agents (Credit & Collections, Procurement Watch, Financing Matcher, Compliance Auditor) working in tandem.
- **Agent Room**: Transparent replay view showing every agent's thought process, verified calculations, and proposed recommendations step-by-step.
- **Human-in-the-Loop Inbox**: No automated action (re-negotiation, collection reminder, financing inquiry) is taken without human approval via an actionable Inbox, with Face ID / biometric confirmation for sensitive transactions.

### 3. 📑 Smart Document Ingestion & Document Generator
- **AI OCR & Ingestion**: Smart parser for tax invoices, purchase orders, receipts, and bank statements with privacy-first data masking.
- **Formal Document Generator**: Instant generation of standardized financial statements, debtor notices, credit requests, and audit-ready reports (PDF & Excel).

### 4. 💼 Working Capital & Order Intelligence
- **New Order Feasibility**: Risk and margin evaluation before committing to new buyer orders against current liquidity.
- **Receivables & Buyer Grading**: Creditworthiness grading of buyers, aging bucket analysis, and AI-worded payment reminder drafting.
- **Procurement & Price Trends**: Raw material pricing forecasts and margin risk alerts.
- **SME Financing Matching**: Non-predatory, automated lender matching based on actual reconciled cash flow.

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript, React 19
- **Styling**: Tailwind CSS v4
- **Database & ORM**: PostgreSQL / SQLite via [Prisma ORM](https://www.prisma.io/)
- **AI Integration**: Google Gemini API (`@google/generative-ai`)
- **Document & PDF Processing**: `pdfjs-dist`, `pdf2json`, `jspdf`, `html2canvas`, `xlsx`
- **Security & Privacy**: Client-side data masking, JWT authentication, bcrypt password hashing

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/) / `pnpm` / `bun`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Its-Guitar/bizmate.git
   cd bizmate
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   # Database Connection
   DATABASE_URL="file:./dev.db" # or your PostgreSQL connection string

   # Authentication Secret
   JWT_SECRET="your-secure-jwt-secret"

   # Google AI (Gemini)
   GEMINI_API_KEY="your-gemini-api-key"
   ```

4. **Initialize Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Architecture

```plaintext
bizmate/
├── app/
│   ├── account/              # User profile & credentials management
│   ├── admin/                # System administration & telemetry
│   ├── api/                  # Next.js API Routes (AI, Auth, Documents, Workflow)
│   ├── components/           # Reusable UI components, modals, and tour guides
│   ├── dashboard/            # Core dashboard modules:
│   │   ├── agent-room/       # Step-by-step agent workflow replay
│   │   ├── data/             # Document ingestion & management
│   │   ├── financing/        # Pre-matched lender matching
│   │   ├── generator/        # Formal document generator (physical paper view)
│   │   ├── new-order/        # Order cash feasibility checker
│   │   ├── procurement/      # Raw material cost tracker
│   │   ├── receivables/      # Buyer grading & aging analysis
│   │   └── trust/            # Compliance & audit-trail status
│   └── docs/                 # Built-in platform walkthrough & onboarding docs
├── lib/
│   ├── ai/                   # Gemini client, guardrails, and data masking
│   ├── audit-chain.ts        # Cryptographic verification & audit trail
│   ├── calculation-pipeline.ts # Deterministic financial math calculations
│   ├── financing-engine.ts   # Working capital & loan calculation engine
│   └── workflow-engine.ts    # Multi-agent state orchestration & inbox actions
├── prisma/                   # Prisma schema and database migrations
└── public/                   # Static assets, branding, and documentation media
```

---

## 🔒 Security & Guardrails

- **Data Masking**: Personally Identifiable Information (PII) and raw banking credentials are masked prior to ingestion and AI processing.
- **Deterministic Calculation Pipeline**: Critical financial health metrics, interest calculations, and ledger balances are computed via isolated deterministic TypeScript logic—AI models are never relied upon for raw arithmetic.
- **Audit Logging**: Every action, approval, and document ingestion is recorded in an immutable audit chain.

---

## 👤 Author

**Its-Guitar**  
- GitHub: [@Its-Guitar](https://github.com/Its-Guitar)  
- Email: guitar999mc@gmail.com
