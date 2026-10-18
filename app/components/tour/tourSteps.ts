export interface TourStep {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/dashboard",
    target: "health-score-card",
    title: "Welcome to your Home screen",
    body: "This is your Health Score: a single number that sums up how your business is doing right now. Everything else on this page explains what's behind it.",
  },
  {
    id: "ingest-cta",
    route: "/dashboard",
    target: "ingest-data-cta",
    title: "Start here: add your data",
    body: "Click this button to go to the Data page. BizMateAI can only calculate your Health Score, Cash Radar, and Financing Gap once you've added documents.",
  },
  {
    id: "data-upload",
    route: "/dashboard/data",
    target: "data-upload-zone",
    title: "Add or upload documents",
    body: "Drop in invoices, bank statements, or purchase orders here. Each document becomes a verified input to your financial calculations.",
  },
  {
    id: "data-save",
    route: "/dashboard/data",
    target: "data-save-run",
    title: "Save and run the calculation",
    body: "Toggle on the documents you want included, then click here. BizMateAI recalculates your whole financial picture from these verified documents.",
  },
  {
    id: "dashboard-results",
    route: "/dashboard",
    target: "health-score-card",
    title: "Your numbers are live",
    body: "Health Score, Cash Radar, and your ranked issues below are now computed from the documents you just added. Come back here any time for the daily overview.",
  },
  {
    id: "new-order",
    route: "/dashboard/new-order",
    target: "new-order-form",
    title: "Create a new order",
    body: "When you take on a new order, check it here first. BizMateAI flags risks against your current cash position before you commit.",
  },
  {
    id: "receivables",
    route: "/dashboard/receivables",
    target: "receivables-table",
    title: "Receivables and buyer grades",
    body: "See who owes you money, how reliable each buyer has been, and send a reminder or request early payment, all with your explicit approval.",
  },
  {
    id: "procurement",
    route: "/dashboard/procurement",
    target: "procurement-forecast",
    title: "Procurement and material prices",
    body: "Track material price trends and get an early warning when a price swing is about to hit your margins.",
  },
  {
    id: "financing",
    route: "/dashboard/financing",
    target: "financing-match",
    title: "Financing matches",
    body: "If your cash forecast shows a gap, this page matches you to lenders and shows exactly what repayment would look like.",
  },
  {
    id: "trust",
    route: "/dashboard/trust",
    target: "trust-overview",
    title: "Trust and verification",
    body: "This is where your verification status and compliance signals live, the things that make partners and lenders trust your numbers.",
  },
  {
    id: "generator",
    route: "/dashboard/generator",
    target: "generator-panel",
    title: "Document generator",
    body: "Generate the formal documents you need, like statements or formal requests, straight from your verified data.",
  },
  {
    id: "agent-room",
    route: "/dashboard/agent-room",
    target: "agent-room-view",
    title: "Watch the agents work",
    body: "This view replays exactly what each agent checked and proposed for a given run, step by step.",
  },
  {
    id: "inbox",
    route: "/dashboard/inbox",
    target: "inbox-list",
    title: "Approve before anything happens",
    body: "Every action an agent proposes lands here first. Nothing is sent or changed until you approve or decline it. This is the last stop on the tour.",
  },
];
