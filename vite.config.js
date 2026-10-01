import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

function apiDevServerPlugin() {
  return {
    name: "api-dev-server-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          return next();
        }

        const urlObj = new URL(req.url, "http://localhost");
        const endpoint = urlObj.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
        const filePath = path.resolve(process.cwd(), "api", `${endpoint}.js`);

        if (!fs.existsSync(filePath)) {
          return next();
        }

        try {
          const mod = await import(`file://${filePath}?t=${Date.now()}`);
          if (typeof mod.default === "function") {
            let body = {};
            if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const rawBody = Buffer.concat(buffers).toString("utf8");
              if (rawBody) {
                try {
                  body = JSON.parse(rawBody);
                } catch {
                  body = rawBody;
                }
              }
            }

            const query = Object.fromEntries(urlObj.searchParams.entries());
            const mockReq = {
              method: req.method,
              body,
              query,
              headers: req.headers,
              url: req.url,
            };

            const mockRes = {
              statusCode: 200,
              status(code) {
                this.statusCode = code;
                return this;
              },
              setHeader(name, val) {
                res.setHeader(name, val);
                return this;
              },
              json(data) {
                res.statusCode = this.statusCode;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(data));
              },
              send(text) {
                res.statusCode = this.statusCode;
                res.end(text);
              },
            };

            await mod.default(mockReq, mockRes);
            return;
          }
        } catch (err) {
          console.error(`[API Dev Error] /api/${endpoint}:`, err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Internal server error in dev api proxy", details: err.message }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Populate process.env so API handlers can access them
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiDevServerPlugin()],
  };
});
