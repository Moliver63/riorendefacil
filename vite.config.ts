import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: { alias: { "@shared": path.resolve(__dirname, "shared") } },
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5173, proxy: { "/trpc": "http://localhost:3001" } },
});
