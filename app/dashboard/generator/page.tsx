"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { Toast } from "@/app/components/Toast";
import { getSession, AuthUser } from "@/lib/auth-client";
import { COMPANY } from "@/app/data/supplier-copilot-mock";
import { generateMockDocument, type GeneratedDocument } from "@/lib/document-generator";
import { documentToCsvRows, csvRowsToString } from "@/lib/csv-export";
import { downloadBlob } from "@/lib/download-file";
import { ALL_LANGUAGES, type LanguageCode } from "@/lib/generator-i18n";
import { PhysicalPaperView } from "./PhysicalPaperView";
import { RawTextView } from "./RawTextView";
import { ExtractionPanel } from "./ExtractionPanel";
import { ReceiptIcon, ScanIcon, DownloadIcon } from "@/app/components/icons";
import type { ExtractDocumentResponse } from "@/app/api/ai/extract-document/route";

const ARCHETYPE_BADGE_STYLE =
  "text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300";

type ExportFormat = "png" | "jpg" | "pdf" | "xlsx" | "csv";

const EXPORT_FORMATS: Array<{ key: ExportFormat; label: string }> = [
  { key: "png", label: "PNG image" },
  { key: "jpg", label: "JPG image" },
  { key: "pdf", label: "PDF document" },
  { key: "xlsx", label: "Excel (.xlsx)" },
  { key: "csv", label: "CSV file" },
];

const LANGUAGE_LABEL: Record<LanguageCode, string> = { en: "English", zh: "中文", th: "ไทย" };

function chaosBand(level: number): { label: string; className: string } {
  if (level <= 33) return { label: "Calm", className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" };
  if (level <= 66) return { label: "Noisy", className: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" };
  return { label: "Chaotic", className: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" };
}

type LogKind = "local" | "api-real" | "api-simulated" | "error";

interface LogEntry {
  id: string;
  time: string;
  kind: LogKind;
  message: string;
}

const LOG_STYLE: Record<LogKind, string> = {
  local: "text-slate-400",
  "api-real": "text-emerald-400",
  "api-simulated": "text-amber-400",
  error: "text-rose-400",
};

const LOG_TAG: Record<LogKind, string> = {
  local: "LOCAL",
  "api-real": "API",
  "api-simulated": "API·SIM",
  error: "ERROR",
};

export default function GeneratorPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [chaosLevel, setChaosLevel] = useState(30);
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [viewMode, setViewMode] = useState<"paper" | "raw">("paper");
  const [scannerEffect, setScannerEffect] = useState(false);
  const [paperRotationDeg, setPaperRotationDeg] = useState(0);
  const [languages, setLanguages] = useState<Set<LanguageCode>>(new Set(ALL_LANGUAGES));

  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [isExporting, setIsExporting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractDocumentResponse | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const paperRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setIsChecking(false);
  }, [router]);

  const addLog = (kind: LogKind, message: string) => {
    setLogs((prev) => [
      ...prev.slice(-49),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), kind, message },
    ]);
  };

  if (isChecking) {
    return null;
  }

  const band = chaosBand(chaosLevel);

  const toggleLanguage = (lang: LanguageCode) => {
    setLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        if (next.size === 1) return prev; // keep at least one language on
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  };

  const handleCreateMock = () => {
    const next = generateMockDocument(chaosLevel);
    setDoc(next);
    setPaperRotationDeg((Math.random() - 0.5) * 6);
    setExtractionResult(null);
    setToastMessage(`Generated a ${next.archetypeLabel.toLowerCase()}.`);
    addLog("local", `Generated ${next.archetypeLabel} · ${next.layoutVariant} layout · chaos ${chaosLevel} — local randomizer, no AI call, instant.`);
  };

  const captureCanvas = async (scale: number) => {
    if (!paperRef.current) throw new Error("Nothing to capture yet.");
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(paperRef.current, { backgroundColor: "#ffffff", scale });
  };

  const handleExport = async () => {
    if (!doc) return;
    setIsExporting(true);
    try {
      const baseName = `bizmateai-mock-${doc.archetype}-${doc.id}`;

      if (exportFormat === "png" || exportFormat === "jpg") {
        const canvas = await captureCanvas(2);
        const mime = exportFormat === "png" ? "image/png" : "image/jpeg";
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, 0.92));
        if (!blob) throw new Error("Canvas produced no image.");
        downloadBlob(blob, `${baseName}.${exportFormat}`);
        addLog("local", `Exported ${exportFormat.toUpperCase()} (${(blob.size / 1024).toFixed(1)} KB).`);
      } else if (exportFormat === "pdf") {
        const canvas = await captureCanvas(2);
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`${baseName}.pdf`);
        addLog("local", `Exported PDF (${canvas.width}x${canvas.height}px page).`);
      } else if (exportFormat === "xlsx") {
        const XLSX = await import("xlsx");
        const rows = documentToCsvRows(doc);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Document");
        XLSX.writeFile(wb, `${baseName}.xlsx`);
        addLog("local", `Exported Excel workbook (${rows.length} rows).`);
      } else {
        const csv = csvRowsToString(documentToCsvRows(doc));
        const blob = new Blob([csv], { type: "text/csv" });
        downloadBlob(blob, `${baseName}.csv`);
        addLog("local", `Exported CSV (${(blob.size / 1024).toFixed(1)} KB).`);
      }
      setToastMessage(`Downloaded the document as ${exportFormat.toUpperCase()}.`);
    } catch (err) {
      console.error("Export failed:", err);
      addLog("error", `Export to ${exportFormat.toUpperCase()} failed: ${err instanceof Error ? err.message : "unknown error"}.`);
      setToastMessage("Export failed. Check the console.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendToAi = async () => {
    if (!doc || !paperRef.current) return;
    setIsExtracting(true);
    setExtractionResult(null);
    addLog("local", "Rendering the document to an image for the AI agent…");
    const startedAt = performance.now();
    try {
      const canvas = await captureCanvas(1.5);
      const dataUrl = canvas.toDataURL("image/png");
      const imageBase64 = dataUrl.split(",")[1];

      addLog("local", `Captured image, ${(imageBase64.length / 1024).toFixed(0)} KB base64. Calling POST /api/ai/extract-document…`);

      const res = await fetch("/api/ai/extract-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: "image/png",
          archetype: doc.archetype,
          homeCompanyName: COMPANY.name,
          groundTruth: doc.groundTruth,
        }),
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const json: ExtractDocumentResponse = await res.json();
      setExtractionResult(json);

      const matched = Object.keys(json.extractedFields).length;
      if (json.simulated) {
        addLog(
          "api-simulated",
          `POST /api/ai/extract-document → 200 in ${latencyMs}ms, but the live call failed (${json.fallbackReason ?? "unknown reason"}). Fell back to the document's own data.`
        );
      } else {
        addLog(
          "api-real",
          `POST /api/ai/extract-document → 200 in ${latencyMs}ms. Model replied: "${(json.rawModelText ?? "").slice(0, 160)}"`
        );
      }
      setToastMessage(
        json.simulated ? "AI agent unavailable, showed a simulated result instead." : `The AI agent read the document (${matched} fields).`
      );
    } catch (err) {
      console.error("AI extraction failed:", err);
      addLog("error", `Call to the AI agent failed: ${err instanceof Error ? err.message : "unknown error"}.`);
      setToastMessage("Could not reach the AI agent. Try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <div className="animate-fade-in-up">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-1 cursor-pointer inline-flex items-center gap-1"
          >
            <span>←</span>
            <span>Back to Home</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Mock Document & Chaos Data Generator
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate a random invoice, purchase order, receipt, or messy ledger, then preview it,
            export it, or send it straight to the AI agent to see what it reads back.
          </p>
        </div>

        {/* Controls */}
        <div className="animate-fade-in-up delay-100 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
              <ReceiptIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Generator</span>
                <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Testing tool
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Every click is random: new entities, amounts, dates, layouts, and formats, every time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              {ALL_LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <input type="checkbox" checked={languages.has(lang)} onChange={() => toggleLanguage(lang)} className="cursor-pointer" />
                  {LANGUAGE_LABEL[lang]}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wide">Chaos</label>
              <input
                type="range"
                min={0}
                max={100}
                value={chaosLevel}
                onChange={(e) => setChaosLevel(Number(e.target.value))}
                className="w-28"
              />
              <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${band.className}`}>
                {band.label}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCreateMock}
              className="text-sm font-bold px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              {doc ? "Re-roll" : "Create Mock"}
            </button>
          </div>
        </div>

        {!doc ? (
          <div className="animate-fade-in-up delay-150 bg-white dark:bg-slate-900/90 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No document yet. Click <span className="font-semibold text-slate-600 dark:text-slate-300">Create Mock</span> to
            generate a random invoice, purchase order, receipt, or messy ledger with made-up
            companies and numbers, then preview it, export it, or send it to the AI agent.
          </div>
        ) : (
          <>
            {/* Preview */}
            <div className="animate-fade-in-up delay-200 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={ARCHETYPE_BADGE_STYLE}>{doc.archetypeLabel}</span>
                  <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {doc.layoutVariant} layout
                  </span>
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{doc.documentNumber}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                    {([
                      { key: "paper" as const, label: "Physical paper" },
                      { key: "raw" as const, label: "Raw text / CSV" },
                    ]).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setViewMode(opt.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          viewMode === opt.key
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scannerEffect}
                      onChange={(e) => setScannerEffect(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <ScanIcon className="w-3.5 h-3.5" />
                    Scanner effect
                  </label>
                </div>
              </div>

              <div className={viewMode === "paper" ? "" : "hidden"}>
                <PhysicalPaperView
                  doc={doc}
                  scannerEffect={scannerEffect}
                  rotationDeg={paperRotationDeg}
                  paperRef={paperRef}
                  activeLanguages={languages}
                />
              </div>
              <div className={viewMode === "raw" ? "" : "hidden"}>
                <RawTextView doc={doc} activeLanguages={languages} />
              </div>

              {doc.chaosEffectsApplied.length > 0 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                  Chaos applied: {doc.chaosEffectsApplied.join(", ")}.
                </p>
              )}

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {EXPORT_FORMATS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  {isExporting ? "Exporting…" : "Export"}
                </button>
                <button
                  type="button"
                  onClick={handleSendToAi}
                  disabled={isExtracting}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ml-auto"
                >
                  <ScanIcon className="w-3.5 h-3.5" />
                  {isExtracting ? "Reading document…" : "Send to the AI agent"}
                </button>
              </div>
            </div>

            {/* Extraction result */}
            <div className="animate-fade-in-up delay-250 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">What the AI agent read</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Extracted fields next to this document's own known values.
              </p>
              <ExtractionPanel result={extractionResult} groundTruth={doc.groundTruth} isLoading={isExtracting} />
            </div>

            {/* Developer log */}
            <div className="animate-fade-in-up delay-300 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Developer log</h3>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Grey lines are local, no network call. Green and amber lines are real requests to
                the AI agent's API, with timing so you can verify it's actually connected.
              </p>
              <div className="rounded-2xl bg-slate-950 p-3 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-slate-500">No activity yet. Click Create Mock to start.</p>
                ) : (
                  logs.map((entry) => (
                    <p key={entry.id} className={LOG_STYLE[entry.kind]}>
                      <span className="text-slate-600">[{entry.time}]</span>{" "}
                      <span className="font-bold">[{LOG_TAG[entry.kind]}]</span> {entry.message}
                    </p>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
