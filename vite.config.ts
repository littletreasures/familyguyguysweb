import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "serve-prerendered-reviews-preview",
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const cleanPath = req.url.split("?")[0].split("#")[0];
          const isEpisodePath =
            /^\/reviews\/[a-zA-Z0-9_-]+(?:\/)?$/i.test(cleanPath) &&
            !cleanPath.startsWith("/reviews/season/") &&
            !cleanPath.startsWith("/reviews/host/") &&
            cleanPath !== "/reviews" &&
            cleanPath !== "/reviews/";

          if (isEpisodePath) {
            const epId = cleanPath.replace(/^\/reviews\//, "").replace(/\/$/, "");
            const filePath = path.resolve(__dirname, `dist/reviews/${epId}/index.html`);
            if (fs.existsSync(filePath)) {
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              return res.end(fs.readFileSync(filePath, "utf-8"));
            }
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  }
});

