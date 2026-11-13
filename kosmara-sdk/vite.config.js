import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";

// Compila src/index.js en un unico modulo ../sdk/kz-sdk.js que carga la web.
export default defineConfig({
  plugins: [wasm()],
  define: { global: "globalThis" },
  resolve: {
    // El SDK de Orca importa "assert" de Node; en el navegador usamos un sustituto minimo.
    alias: { assert: fileURLToPath(new URL("./src/assert-shim.js", import.meta.url)) },
  },
  build: {
    target: "esnext",
    outDir: "../sdk",
    emptyOutDir: false,
    lib: { entry: "src/index.js", formats: ["es"], fileName: () => "kz-sdk.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
