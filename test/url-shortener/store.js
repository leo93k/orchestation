import { readFileSync, writeFileSync, existsSync } from "fs";

const DATA_FILE = "./data.json";

let urls = {};

export function init() {
  if (existsSync(DATA_FILE)) {
    urls = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  }
}

function persist() {
  writeFileSync(DATA_FILE, JSON.stringify(urls, null, 2));
}

function generateId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function createShortUrl(originalUrl) {
  // Check if URL already shortened
  for (const [id, entry] of Object.entries(urls)) {
    if (entry.url === originalUrl) return { id, ...entry };
  }

  let id = generateId();
  while (urls[id]) id = generateId();

  urls[id] = {
    url: originalUrl,
    clicks: 0,
    createdAt: new Date().toISOString(),
  };
  persist();
  return { id, ...urls[id] };
}

export function resolve(id) {
  const entry = urls[id];
  if (!entry) return null;
  entry.clicks++;
  persist();
  return entry.url;
}

export function getStats(id) {
  return urls[id] || null;
}

export function listAll() {
  return Object.entries(urls).map(([id, entry]) => ({ id, ...entry }));
}
