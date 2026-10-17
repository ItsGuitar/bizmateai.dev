import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      // pdfjs-dist's legacy Node build optionally requires the native
      // `canvas` package for server-side rendering, which we never use
      // (pdf.js runs client-side only here). Stub it out so the build
      // doesn't fail trying to resolve an uninstalled native dependency.
      canvas: "./stubs/canvas.js",
    },
  },
};

export default nextConfig;
