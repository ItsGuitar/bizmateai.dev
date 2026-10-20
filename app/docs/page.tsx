"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { getSession, AuthUser } from "@/lib/auth-client";

interface DocSection {
  id: string;
  step: number;
  title: string;
  body: string[];
  image: string;
  imageAlt: string;
}

const SECTIONS: DocSection[] = [
  {
    id: "dashboard-empty",
    step: 1,
    title: "Your first look at Home",
    body: [
      "When you first log in, your Home screen shows an empty state because BizMateAI has nothing to calculate from yet.",
      "The amber banner tells you exactly what's missing and gives you a direct button to fix it. This is the starting point for every new account.",
    ],
    image: "dashboard-empty.jpg",
    imageAlt: "Home screen before any documents are added, showing the amber empty-state banner",
  },
  {
    id: "data",
    step: 2,
    title: "Add your documents",
    body: [
      "Go to Tools & Agents → Data (or click the empty-state button). Upload or scan invoices, bank statements, or purchase orders.",
      "Toggle on the documents you want included, then click \"Save & Run Calculation\". BizMateAI verifies and matches each document before using it.",
    ],
    image: "data.jpg",
    imageAlt: "Data and Document Ingestion page with uploaded documents and the Save and Run Calculation button",
  },
  {
    id: "dashboard-live",
    step: 3,
    title: "Read your Health Score",
    body: [
      "Back on Home, your Health Score, Cash Radar, and ranked issues are now computed from the documents you added.",
      "The factory visualization is a quick visual read: the busier and greener it looks, the healthier your cash position. Click \"How it works\" to see the five-part score breakdown.",
    ],
    image: "dashboard-live.jpg",
    imageAlt: "Home screen with a live Health Score, Cash Radar chart, and ranked issues",
  },
  {
    id: "new-order",
    step: 4,
    title: "Check a new order before you commit",
    body: [
      "Before taking on a new order, run it through this page. BizMateAI checks it against your current cash position and flags anything risky up front.",
    ],
    image: "new-order.jpg",
    imageAlt: "New order screen",
  },
  {
    id: "receivables",
    step: 5,
    title: "Manage receivables and buyer grades",
    body: [
      "See every buyer who owes you money, how reliably they've paid in the past, and how overdue each invoice is.",
      "You can send an AI-worded reminder or request early payment on an invoice. Neither is sent automatically: it first creates an approval card in your Inbox.",
    ],
    image: "receivables.jpg",
    imageAlt: "Receivables and buyer grades page",
  },
  {
    id: "procurement",
    step: 6,
    title: "Watch material prices",
    body: [
      "This page tracks the material price trends behind your cost of goods, and warns you early when a price swing could hit your margins.",
    ],
    image: "procurement.jpg",
    imageAlt: "Procurement and material price forecast page",
  },
  {
    id: "financing",
    step: 7,
    title: "Close a financing gap",
    body: [
      "If your cash forecast shows a gap, this page matches you to lenders based on your real numbers and shows what repayment would actually look like before you apply.",
    ],
    image: "financing.jpg",
    imageAlt: "Financing matches and repayment page",
  },
  {
    id: "trust",
    step: 8,
    title: "Check your Trust status",
    body: [
      "Trust tracks the verification and compliance signals that make partners and lenders confident in your numbers.",
    ],
    image: "trust.jpg",
    imageAlt: "Trust and verification page",
  },
  {
    id: "agent-room",
    step: 9,
    title: "Watch the agents work",
    body: [
      "The Agent Room replays exactly what each agent checked and proposed for a given run, step by step, so you can see the reasoning behind a recommendation.",
    ],
    image: "agent-room.jpg",
    imageAlt: "Agent Room replay view",
  },
  {
    id: "inbox",
    step: 10,
    title: "Approve everything in your Inbox",
    body: [
      "Every action an agent proposes, a reminder, a discount, a financing application, lands in your Inbox first. Nothing is sent or changed until you approve or decline it.",
      "Items marked with a lock icon require Face ID confirmation before they can be approved.",
    ],
    image: "inbox.jpg",
    imageAlt: "Inbox showing pending approval cards",
  },
];

export default function DocsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
  }, [router]);

  if (isChecking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="animate-fade-in-up mb-6">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            How to use BizMateAI
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            A written walkthrough from your first login to using every agent. Prefer to learn by doing?
            Click <span className="font-bold text-emerald-600 dark:text-emerald-400">Run Tutorial</span> in
            the header for a guided tour of the real app.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden animate-fade-in-up"
            >
              <div className="p-5 pb-0 flex items-center gap-2.5">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
                  Step {section.step}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{section.title}</h2>
              </div>
              <div className="p-5 space-y-2.5">
                {section.body.map((p, i) => (
                  <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <Image
                    src={`/docs/screenshots/${section.image}`}
                    alt={section.imageAlt}
                    width={1280}
                    height={800}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
