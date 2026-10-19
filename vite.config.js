import { config } from 'dotenv';
// Load .env BEFORE importing api.js so JAMENDO_CLIENT_ID is available in
// process.env when the Vite dev-server middleware runs. Vite only auto-loads
// VITE_-prefixed vars; our server-only key has no prefix, so we load it here.
config();
import { defineConfig } from 'vite';
import { routes, sendJson } from './api.js';

// Serve the existing single-page index.html and proxy /api/* requests to the
// same handlers used by the production Express server (see api.js).
export default defineConfig({
  server: {
    host: true,
    port: 3000,
    middlewareMode: false,
  },
  plugins: [
    {
      name: 'musicverse-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, 'http://localhost');
          const path = url.pathname;
          if (routes[path]) {
            // Express-like shim: build a query object and a minimal response.
            const query = Object.fromEntries(url.searchParams);
            const fakeRes = {
              statusCode: 200,
              setHeader() {},
              status(c) { this.statusCode = c; return this; },
              json(body) {
                const payload = JSON.stringify(body);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.writeHead(this.statusCode);
                res.end(payload);
              },
            };
            await sendJson(routes[path], query, fakeRes);
            return;
          }
          next();
        });
      },
    },
  ],
});
