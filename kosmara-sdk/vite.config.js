import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// Compila src/index.js en un unico modulo ../sdk/kz-sdk.js que carga 020.html
export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  define: { global: "globalThis" },
  build: {
    target: "es2022",
    outDir: "../sdk",
    emptyOutDir: false,
    lib: { entry: "src/index.js", formats: ["es"], fileName: () => "kz-sdk.js" },
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
