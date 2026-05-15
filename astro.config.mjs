import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://flightyco2.com",
  integrations: [svelte({ emitCss: true })],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Bundle all component CSS into one file even for lazy-imported chunks.
      // Avoids missing-style flashes for modals that Vite would otherwise
      // emit JS-only chunks for (vite-plugin-svelte conditional-render quirk).
      cssCodeSplit: false,
      rollupOptions: {
        // Svelte's `transition:fade` / `transition:fly` directives still
        // require the import at source level, but Vite's static analyzer
        // can't see the usage after Svelte compiles them away. Suppress
        // those specific UNUSED_EXTERNAL_IMPORT warnings.
        onwarn(warning, defaultHandler) {
          if (
            warning.code === "UNUSED_EXTERNAL_IMPORT" &&
            /svelte\/(transition|easing)/.test(warning.message ?? "")
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
  },
  output: "static",
});
