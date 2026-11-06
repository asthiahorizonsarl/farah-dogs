import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Bibliothèques de conversion Word → PDF chargées telles quelles côté serveur (polices, jsdom).
  serverExternalPackages: ["pdfmake", "fontkit", "@xmldom/xmldom"],
  // Envoi des modèles Word (.docx) depuis les Paramètres.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
