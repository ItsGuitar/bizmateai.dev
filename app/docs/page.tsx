"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AppHeader } from "@/app/components/AppHeader";

export default function SwaggerDocsPage() {
  const initSwagger = () => {
    // @ts-expect-error SwaggerUIBundle is loaded dynamically via script tag
    if (typeof window !== "undefined" && window.SwaggerUIBundle) {
      // @ts-expect-error SwaggerUIBundle initialized
      window.SwaggerUIBundle({
        url: "/api/docs",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          // @ts-expect-error SwaggerUIBundle presets
          window.SwaggerUIBundle.presets.apis,
          // @ts-expect-error SwaggerUIStandalonePreset
          window.SwaggerUIStandalonePreset,
        ],
        layout: "BaseLayout",
        persistAuthorization: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
      });
    }
  };

  useEffect(() => {
    initSwagger();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col">
      {/* Swagger UI CSS from official CDN */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css"
      />

      {/* Universal Top Navigation Header */}
      <AppHeader activeNav="docs" />

      {/* Info notice bar */}
      <div className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-2.5 px-6 text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            💡 <strong>Interactive Testing:</strong> Click <strong>Authorize</strong> to paste your Bearer token from <code>/api/auth/login</code> to test protected agent endpoints.
          </span>
          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
            OpenAPI Spec: /api/docs
          </span>
        </div>
      </div>

      {/* Swagger UI Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div id="swagger-ui" className="swagger-ui-custom" />
      </main>

      {/* Script Tags for Swagger UI Bundle */}
      <Script
        src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={initSwagger}
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
        onLoad={initSwagger}
      />

      <style jsx global>{`
        /* Swagger UI Dark Mode Adaptations */
        .dark .swagger-ui {
          filter: invert(88%) hue-rotate(180deg);
        }
        .dark .swagger-ui .highlight-code,
        .dark .swagger-ui .microlight,
        .dark .swagger-ui img {
          filter: invert(100%) hue-rotate(180deg);
        }
        .swagger-ui .topbar {
          display: none !important;
        }
        .swagger-ui .wrapper {
          padding: 0 !important;
          max-width: 100% !important;
        }
      `}</style>
    </div>
  );
}
