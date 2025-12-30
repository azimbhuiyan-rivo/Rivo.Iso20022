import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repo = "Rivo.Iso20022";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? `/${repo}/` : "/",
});
