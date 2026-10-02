import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client/public"),
  plugins: [react()],
  resolve: { alias: { "@shared": path.resolve(__dirname, "shared") } },
  build: { outDir: path.resolve(__dirname, "dist/public"), emptyOutDir: true },
});
