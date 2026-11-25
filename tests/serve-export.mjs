// Serve the production export at its real deployment prefix, with no fallback routes.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve("out");
const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain" };

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (prefix && path === prefix) {
      res.writeHead(301, { Location: `${prefix}/` }).end();
      return;
    }
    if (!path.startsWith(`${prefix}/`)) throw new Error("outside deployment");
    let file = resolve(root, `.${path.slice(prefix.length)}`);
    if (file !== root && !file.startsWith(root + sep)) throw new Error("outside export");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(Number(process.env.PLAYWRIGHT_PORT || 4187), "127.0.0.1");
