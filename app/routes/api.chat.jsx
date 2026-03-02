import { json } from "@remix-run/node";
import { handleIncomingChatMessage } from "../models/chatbot.server";

function withCorsHeaders(headers = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  };
}

export function loader({ request }) {
  // Handle preflight OPTIONS requests that some browsers route through loader
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: withCorsHeaders() });
  }
  return json(
    { ok: true, endpoint: "/api/chat" },
    { headers: withCorsHeaders() },
  );
}

export async function action({ request }) {
  // Handle CORS preflight (OPTIONS) — Remix routes non-GET to action
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: withCorsHeaders() });
  }

  try {
    const body = await request.json();
    const shopDomain = String(body?.shop || "").trim().toLowerCase();
    const message = String(body?.message || "").trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!shopDomain || !message) {
      return json(
        {
          error: "shop and message are required",
        },
        {
          status: 400,
          headers: withCorsHeaders(),
        },
      );
    }

    const reply = await handleIncomingChatMessage({
      shopDomain,
      message,
      history,
      sourcePage: body?.sourcePage || body?.page || null,
      locale: body?.locale || "en",
      externalSessionId: body?.sessionId || body?.session || null,
      visitorId: body?.visitorId || null,
    });

    return json(reply, {
      headers: withCorsHeaders(),
    });
  } catch (_error) {
    return json(
      {
        text: "I am having trouble right now. Please try again in a moment.",
        products: [],
        resources: [],
      },
      {
        status: 200,
        headers: withCorsHeaders(),
      },
    );
  }
}
