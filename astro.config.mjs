import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [svelte({ emitCss: true })],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Bundle all component CSS into one file even for lazy-imported chunks.
      // Avoids missing-style flashes for modals that Vite would otherwise
      // emit JS-only chunks for (vite-plugin-svelte conditional-render quirk).
      cssCodeSplit: false,
    },
  },
  output: "static",
});
