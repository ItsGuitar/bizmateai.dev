// Shared client-side file-download helper: Blob -> object URL -> detached <a download> click ->
// revoke. Extracted from the one existing inline instance (app/dashboard/trust/page.tsx's
// handleExport) since the generator page needs this pattern twice (PNG + CSV).

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
