import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [svelte({ emitCss: false })],
  vite: {
    plugins: [tailwindcss()],
  },
  output: "static",
});
