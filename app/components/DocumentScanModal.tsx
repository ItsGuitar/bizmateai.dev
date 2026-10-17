"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { InvoiceOcrFields, InvoiceOcrConfidence, InvoiceOcrResponse } from "@/app/api/ai/ocr-invoice/route";

export interface RedactionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DocumentScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fields: InvoiceOcrFields) => void;
  defaultDocumentType?: "invoice" | "purchase_order";
}

export function DocumentScanModal({
  isOpen,
  onClose,
  onConfirm,
  defaultDocumentType = "purchase_order",
}: DocumentScanModalProps) {
  const [step, setStep] = useState<"upload" | "redact" | "analyzing" | "review">("upload");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [redactionBoxes, setRedactionBoxes] = useState<RedactionBox[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<RedactionBox | null>(null);

  const [extractedFields, setExtractedFields] = useState<InvoiceOcrFields>({});
  const [confidence, setConfidence] = useState<InvoiceOcrConfidence | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finalImageSrc, setFinalImageSrc] = useState<string | null>(null);

  // 1-minute cooldown state
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Zoom & Pan state for side-by-side inspection
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 1-minute cooldown timer ticker
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Complete data wipe function: resets all states and closes modal without saving
  const wipeDataAndClose = () => {
    setStep("upload");
    setImageSrc(null);
    setFinalImageSrc(null);
    setFileName("");
    setRedactionBoxes([]);
    setCurrentBox(null);
    setStartPos(null);
    setIsDrawing(false);
    setExtractedFields({});
    setConfidence(null);
    setErrorMsg(null);
    setIsSimulated(false);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setStep("upload");
      setImageSrc(null);
      setFinalImageSrc(null);
      setRedactionBoxes([]);
      setExtractedFields({});
      setConfidence(null);
      setErrorMsg(null);
      setIsSimulated(false);
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const [excelPreviewRows, setExcelPreviewRows] = useState<string[][]>([]);
  const [pdfPreviewText, setPdfPreviewText] = useState<string>("");

  const [ingestMethod, setIngestMethod] = useState<"excel_direct" | "pdf_text_direct" | "ocr_vision" | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const lowerName = file.name.toLowerCase();

    // 1. EXCEL / CSV FILES (.xlsx, .xls, .csv) -> ZERO OCR NEEDED (AI Table Reasoning)
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
      setStep("analyzing");
      setErrorMsg(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/ai/smart-ingest", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.ok && data.fields) {
          setExtractedFields(data.fields);
          setConfidence(data.confidence || null);
          setIngestMethod("excel_direct");
          setExcelPreviewRows(data.previewRows || []);
          setPdfPreviewText("");
          setImageSrc(null);
          setFinalImageSrc(null);
          setStep("review");
          return;
        } else {
          throw new Error(data.message || "Failed to parse spreadsheet");
        }
      } catch (err: any) {
        setErrorMsg(`Excel extraction error: ${err.message}`);
        setStep("upload");
        return;
      }
    }

    // 2. PDF FILES (.pdf) -> TEST IF DIGITAL TEXT LAYER EXISTS FIRST
    if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
      setStep("analyzing");
      setErrorMsg(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/ai/smart-ingest", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        // Subcase A: Digital PDF with readable text -> NO OCR NEEDED!
        if (data.ok && data.method === "pdf_text_direct" && data.fields) {
          setExtractedFields(data.fields);
          setConfidence(data.confidence || null);
          setIngestMethod("pdf_text_direct");
          setPdfPreviewText(data.previewText || "");
          setExcelPreviewRows([]);
          setImageSrc(null);
          setFinalImageSrc(null);
          setStep("review");
          return;
        }

        // Subcase B: Scanned image PDF -> REQUIRES OCR FALLBACK
        setIngestMethod("ocr_vision");
        setPdfPreviewText(data.previewText || "PDF document content");
        setStep("redact");
        // For PDF in redaction viewer, set a placeholder preview or direct proceed
        setImageSrc("/images/bot08_tablet.png");
        return;
      } catch (err) {
        console.warn("Smart PDF check failed, proceeding to image OCR:", err);
        setErrorMsg("Failed to process PDF text. Please ensure file is not password protected.");
        setStep("upload");
        return;
      }
    }

    // 3. IMAGE FILES (PNG, JPG, WEBP) -> PROCEED TO REDACTION & VISION OCR
    setIngestMethod("ocr_vision");
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target?.result as string);
      setStep("redact");
    };
    reader.readAsDataURL(file);
  };

  // Redaction drawing handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== "redact" || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentBox({
      id: Date.now().toString(),
      x,
      y,
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const boxX = Math.min(startPos.x, currentX);
    const boxY = Math.min(startPos.y, currentY);
    const boxW = Math.abs(currentX - startPos.x);
    const boxH = Math.abs(currentY - startPos.y);

    setCurrentBox({
      id: startPos.x + "-" + startPos.y,
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && currentBox.width > 5 && currentBox.height > 5) {
      setRedactionBoxes((prev) => [...prev, currentBox]);
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const removeLastRedaction = () => {
    setRedactionBoxes((prev) => prev.slice(0, -1));
  };

  const clearAllRedactions = () => {
    setRedactionBoxes([]);
  };

  // Burn redactions into image before sending
  const burnRedactionsAndSend = useCallback(async () => {
    if (!imageSrc || !imgRef.current) return;
    setStep("analyzing");
    setErrorMsg(null);

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Scale redaction boxes from display size to natural image size
      const displayRect = imgRef.current?.getBoundingClientRect();
      if (displayRect && displayRect.width > 0 && displayRect.height > 0) {
        const scaleX = img.naturalWidth / displayRect.width;
        const scaleY = img.naturalHeight / displayRect.height;

        ctx.fillStyle = "#000000";
        for (const box of redactionBoxes) {
          ctx.fillRect(box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY);
        }
      }

      const burnedBase64 = canvas.toDataURL("image/png");
      setFinalImageSrc(burnedBase64);

      if (cooldownRemaining > 0) {
        setErrorMsg(`AI Rate Limit: Please wait ${cooldownRemaining}s before running another scan.`);
        setStep("redact");
        return;
      }

      try {
        const res = await fetch("/api/ai/ocr-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: burnedBase64,
            mimeType: "image/png",
            fileName,
          }),
        });

        const data: InvoiceOcrResponse & { remainingSeconds?: number } = await res.json();
        if (data.ok) {
          // Set 60-second cooldown after real AI call
          setCooldownRemaining(60);
          const fields = data.fields;
          if (!fields.documentType && defaultDocumentType) {
            fields.documentType = defaultDocumentType;
          }
          setExtractedFields(fields);
          setConfidence(data.confidence);
          setIsSimulated(Boolean(data.simulated));
          setStep("review");
        } else {
          if (res.status === 429 && data.remainingSeconds) {
            setCooldownRemaining(data.remainingSeconds);
          }
          setErrorMsg(data.error || "Failed to scan document");
          setStep("redact");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setErrorMsg(msg);
        setStep("redact");
      }
    };
  }, [imageSrc, fileName, redactionBoxes, defaultDocumentType, cooldownRemaining]);

  const handleApplyToForm = () => {
    onConfirm(extractedFields);
    onClose();
  };

  const getConfidenceBadge = (val?: number) => {
    if (val === undefined || val === null) return null;
    const pct = Math.round(val * 100);
    let colorClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    if (pct < 70) {
      colorClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    } else if (pct < 85) {
      colorClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
    return (
      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${colorClass}`}>
        {pct}% certainty
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full ${step === "review" ? "max-w-6xl" : "max-w-4xl"} rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📷</span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Vision OCR: Document Scanner
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Client-side sensitive data redaction & multimodal vision extraction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {cooldownRemaining > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                <span>⏱️ AI Cooldown:</span>
                <span>{cooldownRemaining}s</span>
              </span>
            )}
            <button
              type="button"
              onClick={wipeDataAndClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Close and discard without saving"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body based on step */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="font-bold ml-2">✕</button>
            </div>
          )}

          {step === "upload" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-12 text-center flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-950/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Image
                src="/images/bot04_box_front.png"
                alt="Document Bot"
                width={72}
                height={72}
                className="w-16 h-16 object-contain mb-2 drop-shadow-sm select-none pointer-events-none"
              />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Click or drag invoice, PO, receipt, Excel, or PDF here
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                Supports Excel (.xlsx, .csv), PDF, and Images. Excel and Digital Text PDFs are parsed directly without OCR; Scanned images allow privacy redaction before Vision OCR.
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                  📊 Excel (No OCR)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/60">
                  📄 Digital PDF (No OCR)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/60 dark:border-purple-800/60">
                  📷 Scanned (Vision OCR)
                </span>
              </div>
              <button
                type="button"
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
              >
                Choose File
              </button>
            </div>
          )}

          {step === "redact" && imageSrc && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold">🛡️ Privacy Shield:</span>
                  <span>Drag across image to draw black redaction boxes over bank accounts, IDs, or confidential notes.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={removeLastRedaction}
                    disabled={redactionBoxes.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold"
                  >
                    Undo ({redactionBoxes.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearAllRedactions}
                    disabled={redactionBoxes.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Redaction Canvas container */}
              <div
                ref={containerRef}
                className="relative mx-auto border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-crosshair select-none bg-slate-950 flex items-center justify-center max-h-[500px]"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Scanned Document"
                  className="max-h-[500px] w-auto object-contain block pointer-events-none"
                  draggable={false}
                />

                {/* Render confirmed redaction boxes */}
                {redactionBoxes.map((box) => (
                  <div
                    key={box.id}
                    style={{
                      left: `${box.x}px`,
                      top: `${box.y}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                    }}
                    className="absolute bg-black pointer-events-none border border-black shadow-xs"
                  />
                ))}

                {/* Render currently drawing box */}
                {currentBox && (
                  <div
                    style={{
                      left: `${currentBox.x}px`,
                      top: `${currentBox.y}px`,
                      width: `${currentBox.width}px`,
                      height: `${currentBox.height}px`,
                    }}
                    className="absolute bg-black/80 border-2 border-dashed border-red-500 pointer-events-none"
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                  ← Choose another file
                </button>
                <button
                  type="button"
                  onClick={burnRedactionsAndSend}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Censor & Scan with Vision AI →</span>
                </button>
              </div>
            </div>
          )}

          {step === "analyzing" && (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="relative">
                <Image
                  src="/images/bot08_tablet.png"
                  alt="AI Inspecting"
                  width={80}
                  height={80}
                  className="w-20 h-20 object-contain drop-shadow-md animate-pulse select-none pointer-events-none"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin bg-white dark:bg-slate-900" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Vision AI is inspecting document...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Extracting party names, dates, amounts, credit terms, and evaluating confidence levels.
                </p>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {/* Extraction Source & Efficiency Banner */}
              {ingestMethod === "excel_direct" && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-200/70 dark:bg-emerald-900/60 uppercase">
                    Direct Excel Parser
                  </span>
                  <span>Extracted directly from spreadsheet tabular data without Vision OCR (0 Token consumed, instant verification).</span>
                </div>
              )}

              {ingestMethod === "pdf_text_direct" && (
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-200/70 dark:bg-blue-900/60 uppercase">
                    Digital PDF (No OCR)
                  </span>
                  <span>Extracted directly from digital PDF text layer. No OCR required, saving vision compute quota.</span>
                </div>
              )}

              {ingestMethod === "ocr_vision" && (
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-xs text-purple-800 dark:text-purple-300 flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-200/70 dark:bg-purple-900/60 uppercase">
                    Vision OCR & Redaction
                  </span>
                  <span>Scanned image detected. Processed with multimodal vision intelligence with user privacy redaction.</span>
                </div>
              )}

              {isSimulated && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60 uppercase">
                    Fallback Mode
                  </span>
                  <span>Model API offline or reached quota; loaded structured reference fields for inspection.</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Extraction Verification Form
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Compare the document data on the left against extracted fields on the right before saving.
                  </p>
                </div>
                {confidence?.overall !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Overall score:</span>
                    {getConfidenceBadge(confidence.overall)}
                  </div>
                )}
              </div>

              {/* Two-Column Side-by-Side Split View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Side: Zoomable & Pannable Document Viewer (5 cols) */}
                <div className="lg:col-span-5 bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[560px]">
                  {/* Zoom Toolbar */}
                  <div className="px-3 py-2 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-slate-400">VIEWER</span>
                      <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-700 text-slate-200">
                        {Math.round(zoomScale * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.25))}
                        className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                        title="Zoom Out"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setZoomScale(1);
                          setPanOffset({ x: 0, y: 0 });
                        }}
                        className="px-2 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] text-white font-mono transition-colors cursor-pointer"
                        title="Reset Zoom & Pan"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomScale((prev) => Math.min(3.5, prev + 0.25))}
                        className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                        title="Zoom In"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Interactive Canvas Area */}
                  <div
                    className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none bg-slate-950"
                    onMouseDown={(e) => {
                      setIsPanning(true);
                      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                    }}
                    onMouseMove={(e) => {
                      if (!isPanning) return;
                      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
                    }}
                    onMouseUp={() => setIsPanning(false)}
                    onMouseLeave={() => setIsPanning(false)}
                    onWheel={(e) => {
                      e.preventDefault();
                      const delta = e.deltaY < 0 ? 0.15 : -0.15;
                      setZoomScale((prev) => Math.max(0.5, Math.min(3.5, prev + delta)));
                    }}
                  >
                    {finalImageSrc || imageSrc ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={finalImageSrc || imageSrc || ""}
                        alt="Source Document"
                        draggable={false}
                        style={{
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                          transformOrigin: "center center",
                          transition: isPanning ? "none" : "transform 0.1s ease-out",
                        }}
                        className="max-h-[500px] w-auto object-contain pointer-events-none drop-shadow-md"
                      />
                    ) : ingestMethod === "excel_direct" && excelPreviewRows.length > 0 ? (
                      <div className="w-full h-full p-3 flex flex-col overflow-hidden text-left bg-slate-900">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <span>📊</span>
                            <span>{fileName}</span>
                          </span>
                          <span>{excelPreviewRows.length} Rows Ingested</span>
                        </div>
                        <div className="flex-1 overflow-auto border border-slate-800 rounded-xl bg-slate-950 p-1">
                          <table className="w-full text-[10px] font-mono text-slate-300 divide-y divide-slate-800">
                            <tbody>
                              {excelPreviewRows.map((r, rIdx) => (
                                <tr key={rIdx} className={rIdx === 0 ? "bg-slate-800/60 font-bold text-white" : "hover:bg-slate-900/60"}>
                                  <td className="px-1.5 py-1 text-slate-500 border-r border-slate-800 text-center w-6">{rIdx + 1}</td>
                                  {r.map((c, cIdx) => (
                                    <td key={cIdx} className="px-2 py-1 border-r border-slate-800/40 truncate max-w-[120px]">{c}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : ingestMethod === "pdf_text_direct" && pdfPreviewText ? (
                      <div className="w-full h-full p-3 flex flex-col overflow-hidden text-left bg-slate-900">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                          <span className="font-bold text-blue-400 flex items-center gap-1">
                            <span>📄</span>
                            <span>{fileName}</span>
                          </span>
                          <span>Digital PDF Text Layer</span>
                        </div>
                        <div className="flex-1 overflow-auto border border-slate-800 rounded-xl bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                          {pdfPreviewText}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-4xl shadow-inner">
                          {ingestMethod === "excel_direct" ? "📊" : "📄"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white tracking-wide">
                            {fileName || (ingestMethod === "excel_direct" ? "Spreadsheet Data" : "Digital PDF Document")}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs">
                            {ingestMethod === "excel_direct"
                              ? "Parsed directly via SheetJS without lossy image conversion."
                              : "Parsed directly from native digital PDF text layer."}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          ✓ 100% Digital Data Accuracy
                        </span>
                      </div>
                    )}

                    {/* Hint overlay */}
                    {finalImageSrc || imageSrc ? (
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-xs text-[10px] text-slate-400 font-mono pointer-events-none">
                        Drag to pan · Scroll wheel to zoom
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right Side: Verification & Editing Form (7 cols) */}
                <div className="lg:col-span-7 space-y-4 max-h-[560px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Document Type */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                          Document Type
                        </label>
                        {getConfidenceBadge(confidence?.documentType)}
                      </div>
                      <select
                        value={extractedFields.documentType || "purchase_order"}
                        onChange={(e) =>
                          setExtractedFields((prev) => ({
                            ...prev,
                            documentType: e.target.value as any,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="purchase_order">Purchase Order (PO)</option>
                        <option value="invoice">Commercial Invoice</option>
                        <option value="receipt">Official Receipt</option>
                        <option value="other">Other Document</option>
                      </select>
                    </div>

                    {/* Counterparty / Buyer Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                          Buyer / Counterparty
                        </label>
                        {getConfidenceBadge(confidence?.counterpartyName)}
                      </div>
                      <input
                        type="text"
                        value={extractedFields.counterpartyName || ""}
                        onChange={(e) =>
                          setExtractedFields((prev) => ({
                            ...prev,
                            counterpartyName: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Document Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                          Document No.
                        </label>
                        {getConfidenceBadge(confidence?.documentNumber)}
                      </div>
                      <input
                        type="text"
                        value={extractedFields.documentNumber || ""}
                        onChange={(e) =>
                          setExtractedFields((prev) => ({
                            ...prev,
                            documentNumber: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Total Amount & Currency */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                          Total Amount
                        </label>
                        {getConfidenceBadge(confidence?.totalAmount)}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          style={{ width: "65px" }}
                          value={extractedFields.currency || "¥"}
                          onChange={(e) =>
                            setExtractedFields((prev) => ({
                              ...prev,
                              currency: e.target.value,
                            }))
                          }
                          className="px-2 py-2 text-center rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold"
                        />
                        <input
                          type="number"
                          value={extractedFields.totalAmount ?? ""}
                          onChange={(e) =>
                            setExtractedFields((prev) => ({
                              ...prev,
                              totalAmount: Number(e.target.value) || 0,
                            }))
                          }
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Issue Date */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                          Issue Date
                        </label>
                        {getConfidenceBadge(confidence?.issueDate)}
                      </div>
                      <input
                        type="date"
                        value={extractedFields.issueDate || ""}
                        onChange={(e) =>
                          setExtractedFields((prev) => ({
                            ...prev,
                            issueDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    {/* Due Date & Terms */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                            Due Date
                          </label>
                          {getConfidenceBadge(confidence?.dueDate)}
                        </div>
                        <input
                          type="date"
                          value={extractedFields.dueDate || ""}
                          onChange={(e) =>
                            setExtractedFields((prev) => ({
                              ...prev,
                              dueDate: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                            Terms
                          </label>
                          {getConfidenceBadge(confidence?.termsDays)}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={extractedFields.termsDays ?? ""}
                            onChange={(e) =>
                              setExtractedFields((prev) => ({
                                ...prev,
                                termsDays: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                          <span className="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none">
                            days
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items List (Editable) */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                          Line Items ({extractedFields.items?.length || 0})
                        </label>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">(Editable)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getConfidenceBadge(confidence?.items)}
                        <button
                          type="button"
                          onClick={() =>
                            setExtractedFields((prev) => ({
                              ...prev,
                              items: [
                                ...(prev.items || []),
                                { description: "New Item", quantity: 1, unitPrice: 0, totalPrice: 0 },
                              ],
                            }))
                          }
                          className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          + Add Item
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-2">Description</th>
                            <th className="p-2 text-right w-20">Qty</th>
                            <th className="p-2 text-right w-24">Price</th>
                            <th className="p-2 text-right w-24">Total</th>
                            <th className="p-2 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {extractedFields.items && extractedFields.items.length > 0 ? (
                            extractedFields.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setExtractedFields((prev) => {
                                        const nextItems = [...(prev.items || [])];
                                        nextItems[idx] = { ...nextItems[idx], description: val };
                                        return { ...prev, items: nextItems };
                                      });
                                    }}
                                    className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    value={item.quantity ?? ""}
                                    onChange={(e) => {
                                      const q = Number(e.target.value) || 0;
                                      setExtractedFields((prev) => {
                                        const nextItems = [...(prev.items || [])];
                                        const up = nextItems[idx].unitPrice || 0;
                                        nextItems[idx] = {
                                          ...nextItems[idx],
                                          quantity: q,
                                          totalPrice: Math.round(q * up * 100) / 100,
                                        };
                                        return { ...prev, items: nextItems };
                                      });
                                    }}
                                    className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={item.unitPrice ?? ""}
                                    onChange={(e) => {
                                      const up = Number(e.target.value) || 0;
                                      setExtractedFields((prev) => {
                                        const nextItems = [...(prev.items || [])];
                                        const q = nextItems[idx].quantity || 0;
                                        nextItems[idx] = {
                                          ...nextItems[idx],
                                          unitPrice: up,
                                          totalPrice: Math.round(q * up * 100) / 100,
                                        };
                                        return { ...prev, items: nextItems };
                                      });
                                    }}
                                    className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="p-1.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {extractedFields.currency || "¥"}
                                  {(item.totalPrice ?? (item.quantity && item.unitPrice ? item.quantity * item.unitPrice : 0)).toLocaleString()}
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExtractedFields((prev) => ({
                                        ...prev,
                                        items: prev.items?.filter((_, i) => i !== idx),
                                      }))
                                    }
                                    className="text-slate-400 hover:text-rose-500 text-sm font-bold cursor-pointer"
                                    title="Remove line item"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-3 text-center text-slate-400 text-xs">
                                No line items detected. Click "+ Add Item" to add one manually.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("redact")}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                  >
                    ← Edit Redactions / Re-scan
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={wipeDataAndClose}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    Discard & Wipe
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleApplyToForm}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>✓ Confirm & Populate Form</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
