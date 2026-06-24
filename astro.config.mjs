import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://cinera.es",
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Figtree",
      cssVariable: "--font-figtree",
      weights: ["300 900"],
      styles: ["normal", "italic"],
      subsets: ["latin", "latin-ext"],
      fallbacks: ["sans-serif"],
      display: "swap",
    },
    {
      provider: fontProviders.google(),
      name: "Fraunces",
      cssVariable: "--font-fraunces",
      weights: ["300 900"],
      styles: ["normal", "italic"],
      subsets: ["latin", "latin-ext"],
      fallbacks: ["serif"],
      display: "swap",
    },
  ],
  image: {
    // Optimización de imágenes
    domains: ["cinera.es"],
    remotePatterns: [{ protocol: "https" }],
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        limitInputPixels: false,
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": "/src",
        "@components": "/src/components",
        "@assets": "/src/assets",
        "@data": "/src/data",
        "@content": "/src/content",
        "@styles": "/src/styles",
      },
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "es",
        locales: {
          es: "es-ES",
        },
      },
      serialize(item) {
        if (item.url === "https://cinera.es/") {
          return { ...item, priority: 1.0, changefreq: "weekly" };
        }
        return { ...item, priority: 0.5, changefreq: "monthly" };
      },
    }),
  ],
});
