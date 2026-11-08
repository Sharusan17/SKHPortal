import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The admin app is served under /admin. In dev, Vite serves the page and forwards
// /admin/api to the Python server on 8501.
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: { port: 5173, proxy: { "/admin/api": "http://127.0.0.1:8501" } },
});
