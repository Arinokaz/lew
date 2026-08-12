import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "docs");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = normalize(decoded).replace(/^[/\\]+/, "");
  const full = join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  try {
    let filePath = safeJoin(ROOT, req.url || "/");
    if (!filePath) {
      res.writeHead(403);
      return res.end("forbidden");
    }

    let st;
    try {
      st = await stat(filePath);
    } catch {
      filePath = join(ROOT, "index.html");
      st = await stat(filePath);
    }

    if (st.isDirectory()) {
      filePath = join(filePath, "index.html");
      st = await stat(filePath);
    }

    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    const cacheControl = ext === ".html" || ext === ".json"
      ? "no-cache"
      : "public, max-age=3600";

    res.writeHead(200, {
      "content-type": mime,
      "content-length": st.size,
      "cache-control": cacheControl,
      "service-worker-allowed": "/",
    });
    const data = await readFile(filePath);
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(`server error: ${e.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LEW dev server: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`serving from ${ROOT}`);
});
