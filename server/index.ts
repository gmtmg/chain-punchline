import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { handleOpen, handleClose, handleMessage, type WSData } from "./ws";

const app = new Hono();

app.use("/*", cors({ origin: "*" }));

// Serve bundled client files
app.use("/*", serveStatic({ root: "./public" }));

const PORT = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    // WebSocket upgrade
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const ok = server.upgrade<WSData>(req, {
        data: { playerId: "", roomCode: null },
      });
      if (ok) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: {
    open: handleOpen,
    close: handleClose,
    message: handleMessage,
  },
});

console.log(`連結大喜利 server running on http://localhost:${server.port}`);
