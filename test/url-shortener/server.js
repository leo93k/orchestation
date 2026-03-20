import { createServer } from "http";
import { readFileSync } from "fs";
import { init, createShortUrl, resolve, getStats, listAll } from "./store.js";

init();

const PORT = process.env.PORT || 3456;

function parseBody(req) {
  return new Promise((res, rej) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        res(JSON.parse(body));
      } catch {
        rej(new Error("Invalid JSON"));
      }
    });
  });
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function html(res, content) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(content);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Frontend
  if (path === "/" && req.method === "GET") {
    const page = readFileSync(
      new URL("./index.html", import.meta.url),
      "utf-8",
    );
    return html(res, page);
  }

  // API: Create short URL
  if (path === "/api/shorten" && req.method === "POST") {
    try {
      const { url: originalUrl } = await parseBody(req);
      if (!originalUrl) return json(res, 400, { error: "url is required" });

      try {
        new URL(originalUrl);
      } catch {
        return json(res, 400, { error: "Invalid URL format" });
      }

      const entry = createShortUrl(originalUrl);
      return json(res, 201, {
        shortUrl: `http://localhost:${PORT}/${entry.id}`,
        ...entry,
      });
    } catch {
      return json(res, 400, { error: "Invalid request body" });
    }
  }

  // API: List all URLs
  if (path === "/api/urls" && req.method === "GET") {
    return json(res, 200, listAll());
  }

  // API: Get stats for a short URL
  if (path.startsWith("/api/stats/") && req.method === "GET") {
    const id = path.slice("/api/stats/".length);
    const stats = getStats(id);
    if (!stats) return json(res, 404, { error: "Not found" });
    return json(res, 200, { id, ...stats });
  }

  // Redirect short URL
  if (path.length > 1 && !path.includes("/", 1) && req.method === "GET") {
    const id = path.slice(1);
    const originalUrl = resolve(id);
    if (originalUrl) {
      res.writeHead(302, { Location: originalUrl });
      return res.end();
    }
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`URL Shortener running at http://localhost:${PORT}`);
});
