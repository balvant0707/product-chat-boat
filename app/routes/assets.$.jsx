import path from "node:path";
import { readFile } from "node:fs/promises";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveAssetFilePath(assetPath) {
  const raw = String(assetPath || "").replace(/\\/g, "/");
  if (!raw) return "";

  const normalized = path.posix.normalize(raw);
  if (
    normalized.startsWith("..") ||
    normalized.includes("/..") ||
    normalized === "." ||
    path.posix.isAbsolute(normalized)
  ) {
    return "";
  }

  return path.join(process.cwd(), "build", "client", "assets", normalized);
}

function getContentType(assetPath) {
  const ext = path.extname(assetPath || "").toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export async function loader({ params }) {
  const requestedAsset = params["*"];
  const filePath = resolveAssetFilePath(requestedAsset);

  if (!filePath) {
    return new Response("Asset not found", { status: 404 });
  }

  try {
    const body = await readFile(filePath);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": getContentType(requestedAsset),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (_error) {
    return new Response("Asset not found", { status: 404 });
  }
}

