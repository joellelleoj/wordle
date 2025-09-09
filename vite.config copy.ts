import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "public"),

  server: {
    port: 3000,
    host: true,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@types": path.resolve(__dirname, "src/types"),
      "@styles": path.resolve(__dirname, "src/styles"),
      "/src": path.resolve(__dirname, "src"),
    },
  },
});
