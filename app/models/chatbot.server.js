import db from "../db.server.js";
import {
  searchProducts,
  getCollectionProducts,
  lookupOrder,
  getActiveDiscounts,
  validateCoupon,
  getShopMeta,
} from "./shopify.server.js";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_BOT_VALUES = {
  enabled: false,
  botName: "Shop Assistant",
  subtitle: "Online now",
  welcomeMessage:
    "Hi! I am here to help you with products, shipping, order tracking, and returns.",
  offlineMessage:
    "Thanks for reaching out. Our support team will reply as soon as possible.",
  primaryColor: "#008060",
  widgetPosition: "BOTTOM_RIGHT",
  testModeEnabled: false,
  showPoweredBy: true,
  maxProducts: 5,
};

const DEFAULT_AI_VALUES = {
  enabled: false,
  hybridModeEnabled: true,
  provider: "claude",
  tone: "FRIENDLY",
  answerLength: "MEDIUM",
  confidenceThreshold: 0.6,
  temperature: 0.7,
};

// ─── Collection handle mapping ────────────────────────────────────────────────

const COLLECTION_KEYWORDS = {
  "best seller": "best-sellers",
  "bestseller": "best-sellers",
  "new arrival": "new-arrivals",
  "trending": "trending",
  "winter": "winter-collection",
  "summer": "summer-collection",
  "sale": "sale",
  "on sale": "sale",
  "featured": "frontpage",
  "all": "all",
};

function guessCollectionHandle(text) {
  const lower = text.toLowerCase();
  for (const [keyword, handle] of Object.entries(COLLECTION_KEYWORDS)) {
    if (lower.includes(keyword)) return handle;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toWidgetPosition(value) {
  return value === "bottom-left" ? "BOTTOM_LEFT" : "BOTTOM_RIGHT";
}

function fromWidgetPosition(value) {
  return value === "BOTTOM_LEFT" ? "bottom-left" : "bottom-right";
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const n = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(n)) return true;
  if (["false", "0", "no", "off"].includes(n)) return false;
  return fallback;
}

function parseNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeColor(value, fallback = "#008060") {
  const color = String(value || "").trim();
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(color) ? color : fallback;
}

function matchesAny(text, words) {
  const source = String(text || "").toLowerCase();
  if (!source) return false;
  return words.some((word) => source.includes(String(word || "").toLowerCase()));
}

function makeDurationLabel(startedAt, endedAt) {
  if (!startedAt || !endedAt) return "-";
  const diffMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return `${Math.floor(diffMs / 1000)}s`;
}

function normalizeRole(role) {
  if (role === "USER") return "user";
  if (role === "AGENT") return "agent";
  if (role === "SYSTEM") return "system";
  return "bot";
}

function safeDateLabel(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_e) {
    return "-";
  }
}

function shortDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch (_e) {
    return null;
  }
}

// ─── Shop & Config management ─────────────────────────────────────────────────

async function ensureShop(shopDomain) {
  if (!shopDomain) return null;
  return db.shop.upsert({
    where: { shop: shopDomain },
    create: { shop: shopDomain, installed: true, onboardedAt: new Date() },
    update: {},
  });
}

async function ensureConfigRows(shopId) {
  const [botSetting, aiSetting, onboardingProgress] = await db.$transaction([
    db.botSetting.upsert({
      where: { shopId },
      create: { shopId, ...DEFAULT_BOT_VALUES },
      update: {},
    }),
    db.aiSetting.upsert({
      where: { shopId },
      create: { shopId, ...DEFAULT_AI_VALUES },
      update: {},
    }),
    db.onboardingProgress.upsert({
      where: { shopId },
      create: { shopId, stepOneInstalled: true },
      update: { stepOneInstalled: true },
    }),
  ]);
  return { botSetting, aiSetting, onboardingProgress };
}

function buildPublicSettings(botSetting, aiSetting) {
  return {
    botName: botSetting?.botName ?? DEFAULT_BOT_VALUES.botName,
    subtitle: botSetting?.subtitle ?? DEFAULT_BOT_VALUES.subtitle,
    welcomeMessage: botSetting?.welcomeMessage ?? DEFAULT_BOT_VALUES.welcomeMessage,
    offlineMessage: botSetting?.offlineMessage ?? DEFAULT_BOT_VALUES.offlineMessage,
    primaryColor: botSetting?.primaryColor ?? DEFAULT_BOT_VALUES.primaryColor,
    position: fromWidgetPosition(botSetting?.widgetPosition),
    aiProvider: aiSetting?.provider ?? DEFAULT_AI_VALUES.provider,
    apiKey: "",
    hasApiKey: Boolean(aiSetting?.encryptedApiKey),
    maxProducts: botSetting?.maxProducts ?? DEFAULT_BOT_VALUES.maxProducts,
    temperature: aiSetting?.temperature ?? DEFAULT_AI_VALUES.temperature,
    aiConfidenceThreshold: aiSetting?.confidenceThreshold ?? DEFAULT_AI_VALUES.confidenceThreshold,
    isEnabled: Boolean(botSetting?.enabled),
    testModeEnabled: Boolean(botSetting?.testModeEnabled),
    showPoweredBy: Boolean(botSetting?.showPoweredBy),
    aiEnabled: Boolean(aiSetting?.enabled ?? true),
  };
}

export async function getOrCreateSettings(shopDomain) {
  const shop = await ensureShop(shopDomain);
  if (!shop) return buildPublicSettings(null, null);
  const { botSetting, aiSetting } = await ensureConfigRows(shop.id);
  return buildPublicSettings(botSetting, aiSetting);
}

export async function saveSettings(shopDomain, formValues) {
  const shop = await ensureShop(shopDomain);
  if (!shop) return buildPublicSettings(null, null);

  const nextBot = {
    enabled: parseBoolean(formValues.isEnabled, false),
    botName: String(formValues.botName || DEFAULT_BOT_VALUES.botName).slice(0, 80),
    subtitle: String(formValues.subtitle || "").slice(0, 160) || null,
    welcomeMessage: String(formValues.welcomeMessage || DEFAULT_BOT_VALUES.welcomeMessage).slice(0, 2000),
    offlineMessage: String(formValues.offlineMessage || DEFAULT_BOT_VALUES.offlineMessage).slice(0, 2000),
    primaryColor: normalizeColor(formValues.primaryColor, DEFAULT_BOT_VALUES.primaryColor),
    widgetPosition: toWidgetPosition(formValues.position),
    testModeEnabled: parseBoolean(formValues.testModeEnabled, false),
    showPoweredBy: parseBoolean(formValues.showPoweredBy, true),
    maxProducts: parseNumber(formValues.maxProducts, { min: 1, max: 10, fallback: 5 }),
    embedEnabled: parseBoolean(formValues.isEnabled, false),
  };

  const nextAi = {
    provider: String(formValues.aiProvider || DEFAULT_AI_VALUES.provider).slice(0, 64),
    confidenceThreshold: parseNumber(formValues.aiConfidenceThreshold, { min: 0, max: 1, fallback: 0.6 }),
    temperature: parseNumber(formValues.temperature, { min: 0, max: 1, fallback: 0.7 }),
    enabled: parseBoolean(formValues.aiEnabled, true),
  };

  const apiKey = String(formValues.apiKey || "").trim();
  const onboardingUpdate = {
    stepOneInstalled: true,
    stepThreeBrandingDone: Boolean(nextBot.botName && nextBot.primaryColor),
    stepFiveTested: parseBoolean(formValues.testModeEnabled, false),
  };

  const [botSetting, aiSetting] = await db.$transaction([
    db.botSetting.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, ...DEFAULT_BOT_VALUES, ...nextBot },
      update: nextBot,
    }),
    db.aiSetting.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, ...DEFAULT_AI_VALUES, ...nextAi, encryptedApiKey: apiKey || null },
      update: { ...nextAi, ...(apiKey ? { encryptedApiKey: apiKey } : {}) },
    }),
    db.onboardingProgress.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, ...onboardingUpdate },
      update: onboardingUpdate,
    }),
  ]);

  return buildPublicSettings(botSetting, aiSetting);
}

// ─── Conversation helpers ─────────────────────────────────────────────────────

function countProductsInMessages(messages) {
  return messages.reduce((total, msg) => {
    if (msg.type === "PRODUCT_CARD") return total + 1;
    const pp = Array.isArray(msg.payload?.products) ? msg.payload.products.length : 0;
    return total + pp;
  }, 0);
}

function mapConversation(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const firstUser = messages.find((m) => m.role === "USER");
  const latestLead = Array.isArray(conversation.leads) ? conversation.leads[0] : null;
  const endedAt = conversation.resolvedAt || conversation.closedAt || conversation.lastMessageAt || conversation.updatedAt;

  return {
    id: conversation.id,
    customer:
      conversation.customerName ||
      latestLead?.name ||
      (conversation.visitorId ? `Visitor ${conversation.visitorId.slice(0, 6)}` : "Guest"),
    email: conversation.customerEmail || latestLead?.email || "-",
    firstMessage: firstUser?.body || "",
    messages: messages.length,
    products: countProductsInMessages(messages),
    status: String(conversation.status || "PENDING").toLowerCase(),
    startedAt: safeDateLabel(conversation.startedAt),
    startedAtIso: conversation.startedAt?.toISOString?.() || null,
    duration: makeDurationLabel(conversation.startedAt, endedAt),
    thread: messages.slice(-60).map((m) => ({
      role: normalizeRole(m.role),
      text: m.body || "",
    })),
  };
}

export async function listConversations(shopDomain, { take = 150 } = {}) {
  const shop = await db.shop.findUnique({ where: { shop: shopDomain } });
  if (!shop) return [];

  const rows = await db.conversation.findMany({
    where: { shopId: shop.id },
    orderBy: { startedAt: "desc" },
    take,
    include: {
      leads: { orderBy: { createdAt: "desc" }, take: 1 },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  return rows.map(mapConversation);
}

export function summarizeConversations(conversations) {
  const safe = Array.isArray(conversations) ? conversations : [];
  return {
    total: safe.length,
    active: safe.filter((c) => c.status === "active").length,
    pending: safe.filter((c) => c.status === "pending").length,
    resolved: safe.filter((c) => c.status === "resolved").length,
  };
}

export function buildSetupSteps({ onboardingProgress, settings, hasConversations }) {
  const progress = onboardingProgress || {};
  return [
    { id: "install", label: "Install the ChatBot app", done: Boolean(progress.stepOneInstalled), href: null },
    { id: "embed", label: "Enable app embed in theme editor", done: Boolean(progress.stepTwoEmbedEnabled || settings?.isEnabled), href: "/app/settings" },
    { id: "branding", label: "Configure branding and bot behavior", done: Boolean(progress.stepThreeBrandingDone), href: "/app/settings" },
    { id: "knowledge", label: "Enable AI mode and sync knowledge", done: Boolean(progress.stepFourKnowledgeReady), href: "/app/settings" },
    { id: "test", label: "Run storefront test mode", done: Boolean(progress.stepFiveTested || hasConversations), href: "/app/chat-logs" },
  ];
}

// ─── Intent & extraction ──────────────────────────────────────────────────────

function detectIntent(messageText, flowState) {
  const text = String(messageText || "").toLowerCase();
  const original = messageText;

  // Continue active flows first
  if (flowState?.type === "order_tracking") return "order_tracking_continue";

  // Order tracking triggers
  if (
    /where.*(?:my\s+order|package|parcel|order|shipment)/i.test(text) ||
    /track.*(?:order|package|parcel)/i.test(text) ||
    /order\s+(?:status|update|tracking)/i.test(text) ||
    /(?:my\s+)?order\s+#?\d+/i.test(text)
  ) {
    return "order_tracking_start";
  }

  // Coupon validation: ALL-CAPS code + coupon keyword, or "does X work"
  const couponCodeMatch = original.match(/\b([A-Z][A-Z0-9]{3,14})\b/);
  if (
    couponCodeMatch &&
    (/(?:coupon|code|work|valid|apply|use|discount|promo)/i.test(text) ||
      /does\s+[A-Z0-9]+\s+work/i.test(original) ||
      /is\s+[A-Z0-9]+\s+valid/i.test(original))
  ) {
    return "coupon_validate";
  }

  // Active discounts list
  if (/(?:any|show|list|what|current)\s*(?:offer|discount|coupon|promo|deal|sale)/i.test(text)) {
    return "discount_list";
  }

  // COD
  if (/\bcod\b|cash\s+on\s+delivery|cash\s+payment/i.test(text)) {
    return "cod_info";
  }

  // Free shipping / shipping cost
  if (
    /free\s+(?:shipping|delivery)/i.test(text) ||
    /(?:shipping|delivery)\s+(?:charge|cost|fee|amount)/i.test(text)
  ) {
    return "shipping_cost";
  }

  // Delivery ETA
  if (
    /(?:delivery|shipping)\s+(?:time|date|days)/i.test(text) ||
    /when\s+will.*(?:arrive|deliver|reach|come)/i.test(text) ||
    /how\s+long.*(?:deliver|shipping|arrive)/i.test(text)
  ) {
    return "delivery_eta";
  }

  // General shipping
  if (/\bshipping\b|\bdelivery\b/i.test(text)) {
    return "shipping_info";
  }

  // Returns & refunds
  if (/\breturn\b|\brefund\b|\bexchange\b|\breplace\b/i.test(text)) {
    return "returns";
  }

  // Gift products
  if (/\bgift\b|\bfreebie\b|\bfree\s+product\b|\bfree\s+gift\b|\bmilestone\b/i.test(text)) {
    return "gift_info";
  }

  // Cart
  if (/(?:my\s+cart|show\s+cart|cart\s+total|what.*in.*cart|cart\s+summary)/i.test(text)) {
    return "cart_summary";
  }

  // Human agent
  if (matchesAny(text, ["human", "agent", "support", "representative", "complaint", "speak to"])) {
    return "human";
  }

  // Recommendation / upsell
  if (
    /(?:suggest|recommend|similar|goes\s+well|bought\s+together|bundle|combo|upsell)/i.test(text)
  ) {
    return "recommendation";
  }

  // Product search with attributes
  const hasPriceFilter = /(?:under|below|less\s*than|₹|rs\.?)\s*\d+/i.test(text);
  const hasColorFilter =
    /\b(?:red|blue|green|black|white|yellow|pink|purple|brown|grey|gray|orange|beige|navy|silver|gold)\b/i.test(text);
  const hasSizeFilter =
    /\b(?:xs|s|m|l|xl|xxl|small|medium|large)\b/i.test(text);
  const hasStockFilter = /\bin\s+stock\b|available\s+only/i.test(text);

  if (hasPriceFilter || hasColorFilter || hasSizeFilter || hasStockFilter) {
    return "product_filter_search";
  }

  // Collection / category
  if (
    /(?:collection|category|winter|summer|monsoon|festive|best\s+seller|new\s+arrival|trending|all\s+products)/i.test(text)
  ) {
    return "collection_search";
  }

  // Generic product search
  if (
    /(?:find|search|show\s+me|looking\s+for|do\s+you\s+have|buy|shop\s+for|want\s+to\s+buy)/i.test(text) ||
    text.length < 60
  ) {
    return "product_search";
  }

  return "general";
}

function extractProductParams(text) {
  const lower = text.toLowerCase();

  const priceMatch = lower.match(/(?:under|below|less\s*than|₹|rs\.?|inr)\s*(\d+)/i);
  const priceMax = priceMatch ? parseInt(priceMatch[1]) : null;

  const colors = [
    "red", "blue", "green", "black", "white", "yellow", "pink",
    "purple", "brown", "grey", "gray", "orange", "beige", "navy", "silver", "gold",
  ];
  const foundColor = colors.find((c) => new RegExp(`\\b${c}\\b`, "i").test(lower));

  const sizeMatch = lower.match(/\b(xs|s|m|l|xl|xxl|small|medium|large|\d{2,3})\s*(?:size)?\b/i);
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : null;

  const inStock = /\bin\s+stock\b|available\s+only/i.test(lower);

  let searchQuery = text
    .replace(/(?:under|below|less\s*than)\s*[₹rs\.]*\s*\d+/gi, "")
    .replace(/\b(?:xs|s|m|l|xl|xxl|small|medium|large)\b/gi, "")
    .replace(new RegExp(`\\b(${colors.join("|")})\\b`, "gi"), "")
    .replace(/(?:in\s+)?stock|available\s+only|show\s+me|find|search(?:\s+for)?|looking\s+for|do\s+you\s+have|buy|shop\s+for|want\s+to\s+buy/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    searchQuery: searchQuery || text.trim(),
    priceMax,
    color: foundColor || null,
    size,
    inStock,
  };
}

function extractCouponCode(text) {
  const match = text.match(/\b([A-Z][A-Z0-9]{3,14})\b/);
  return match ? match[1] : null;
}

function extractOrderIdentifiers(text) {
  const orderNameMatch = text.match(/#\s*(\d+)/);
  const orderFallback = !orderNameMatch
    ? text.match(/(?:order\s+(?:no\.?|number|id|#)\s*)[#]?(\d{4,})/i)
    : null;

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+?91\s?)?[6-9]\d{9}/);

  return {
    orderName: orderNameMatch
      ? `#${orderNameMatch[1]}`
      : orderFallback
        ? `#${orderFallback[1]}`
        : null,
    email: emailMatch?.[0] || null,
    phone: phoneMatch?.[0]?.replace(/\s/g, "") || null,
  };
}

function detectLeadData(messageText) {
  const text = String(messageText || "");
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/\+?[0-9][0-9\s-]{7,14}[0-9]/);
  return {
    email: emailMatch?.[0] || null,
    phone: phoneMatch?.[0] || null,
  };
}

// ─── Response builders ────────────────────────────────────────────────────────

function ok(text, type = "text", data = null, extra = {}) {
  return { text, type, ...(data ? { data } : {}), products: [], resources: [], ...extra };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleIncomingChatMessage({
  shopDomain,
  message,
  history = [],
  sourcePage = null,
  locale = "en",
  externalSessionId = null,
  visitorId = null,
}) {
  const cleanMessage = String(message || "").trim().slice(0, 2000);
  if (!cleanMessage) {
    return ok("Please type your message so I can help.");
  }

  const shop = await ensureShop(shopDomain);
  if (!shop) {
    return ok("Store is not configured for chat yet.");
  }

  const [settings] = await Promise.all([
    getOrCreateSettings(shopDomain),
    ensureConfigRows(shop.id),
  ]);

  // ── Find or create conversation ──
  let conversation = null;
  if (externalSessionId) {
    conversation = await db.conversation.findFirst({
      where: {
        shopId: shop.id,
        externalSessionId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        shopId: shop.id,
        source: "WIDGET",
        locale: String(locale || "en").slice(0, 16),
        sourcePage: sourcePage ? String(sourcePage).slice(0, 1000) : null,
        externalSessionId: externalSessionId ? String(externalSessionId).slice(0, 191) : null,
        visitorId: visitorId ? String(visitorId).slice(0, 191) : null,
        metadata: { initialHistoryCount: Array.isArray(history) ? history.length : 0 },
      },
    });
  }

  // ── Store user message ──
  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      shopId: shop.id,
      role: "USER",
      type: "TEXT",
      body: cleanMessage,
    },
  });

  // ── Lead detection ──
  const detectedLead = detectLeadData(cleanMessage);
  if (detectedLead.email || detectedLead.phone) {
    const existingLead = await db.lead.findFirst({
      where: { shopId: shop.id, conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
    });
    if (existingLead) {
      await db.lead.update({
        where: { id: existingLead.id },
        data: {
          email: detectedLead.email || existingLead.email,
          phone: detectedLead.phone || existingLead.phone,
        },
      });
    } else {
      await db.lead.create({
        data: {
          shopId: shop.id,
          conversationId: conversation.id,
          email: detectedLead.email,
          phone: detectedLead.phone,
          consentGiven: false,
          tags: ["Interested"],
        },
      });
    }
  }

  // ── Flow state from conversation metadata ──
  const meta = (conversation.metadata && typeof conversation.metadata === "object")
    ? conversation.metadata
    : {};
  const flowState = meta.flowState || null;

  // ── Intent detection ──
  const intent = detectIntent(cleanMessage, flowState);

  // ── Handle intents ──
  let reply = null;
  let nextFlowState = null;
  let handoff = false;
  let messageType = "TEXT";

  // 1. ORDER TRACKING ──────────────────────────────────────────────────────────
  if (intent === "order_tracking_start") {
    nextFlowState = { type: "order_tracking", step: "awaiting_identifier" };
    reply = ok(
      "Sure! Please share your order number (e.g., #1234) or the email/phone number you used while placing the order.",
      "text",
      null,
      {
        quickReplies: ["My order #...", "Use my email", "Cancel"],
      },
    );
  } else if (intent === "order_tracking_continue") {
    const ids = extractOrderIdentifiers(cleanMessage);
    const emailFromMsg = detectedLead.email || ids.email;
    const phoneFromMsg = detectedLead.phone || ids.phone;
    const savedEmail = flowState?.email || null;

    // If they say cancel / stop
    if (/cancel|stop|never mind|forget/i.test(cleanMessage)) {
      nextFlowState = null;
      reply = ok("No problem! Is there anything else I can help you with?");
    } else if (ids.orderName || ids.orderName) {
      // Have order number - look up directly
      const orderData = await lookupOrder(shopDomain, {
        orderName: ids.orderName,
        email: emailFromMsg || savedEmail,
      });
      nextFlowState = null;
      if (orderData) {
        reply = ok(
          `Here's the status for order **${orderData.orderName}**:`,
          "order_status",
          {
            ...orderData,
            processedAtFormatted: shortDate(orderData.processedAt),
            estimatedDeliveryFormatted: shortDate(orderData.estimatedDelivery),
            deliveredAtFormatted: shortDate(orderData.deliveredAt),
          },
          {
            quickReplies: ["Need more help?", "Track another order", "Returns & Refunds"],
          },
        );
      } else {
        reply = ok(
          `I couldn't find an order with number **${ids.orderName}**. Please double-check the order number or try with your registered email address.`,
          "text",
          null,
          { quickReplies: ["Try with email", "Contact Support"] },
        );
      }
    } else if (emailFromMsg || phoneFromMsg) {
      // Have email/phone - look up
      const orderData = await lookupOrder(shopDomain, {
        email: emailFromMsg,
        phone: phoneFromMsg,
      });
      nextFlowState = null;
      if (orderData) {
        reply = ok(
          `Found your order! Here are the details for **${orderData.orderName}**:`,
          "order_status",
          {
            ...orderData,
            processedAtFormatted: shortDate(orderData.processedAt),
            estimatedDeliveryFormatted: shortDate(orderData.estimatedDelivery),
            deliveredAtFormatted: shortDate(orderData.deliveredAt),
          },
          {
            quickReplies: ["Track another order", "Returns & Refunds", "Contact Support"],
          },
        );
      } else {
        nextFlowState = {
          type: "order_tracking",
          step: "awaiting_order_number",
          email: emailFromMsg,
          phone: phoneFromMsg,
        };
        reply = ok(
          `I didn't find a recent order for ${emailFromMsg || phoneFromMsg}. Could you also share the order number (e.g., #1234)?`,
          "text",
          null,
          { quickReplies: ["#...", "Cancel"] },
        );
      }
    } else {
      reply = ok(
        "Please share your order number (e.g., #1234) or the email/phone used for the order.",
        "text",
        null,
        { quickReplies: ["Cancel"] },
      );
    }

  // 2. PRODUCT SEARCH ──────────────────────────────────────────────────────────
  } else if (intent === "product_search" || intent === "product_filter_search") {
    const params = extractProductParams(cleanMessage);
    const limit = settings?.maxProducts || 5;
    const products = await searchProducts(shopDomain, { ...params, limit });

    if (products.length) {
      const filterDesc = [
        params.color ? `color: ${params.color}` : null,
        params.priceMax ? `under ₹${params.priceMax}` : null,
        params.size ? `size: ${params.size}` : null,
        params.inStock ? "in stock only" : null,
      ]
        .filter(Boolean)
        .join(", ");

      reply = ok(
        `Here are some products${filterDesc ? ` (${filterDesc})` : ""} I found:`,
        "product_cards",
        { products },
        {
          products,
          quickReplies: ["Show more", "Different category", "Price filter"],
        },
      );
    } else {
      reply = ok(
        `I couldn't find products matching "${params.searchQuery}". Try a different keyword, or browse our collections.`,
        "text",
        null,
        { quickReplies: ["Best Sellers", "New Arrivals", "All Products"] },
      );
    }

  // 3. COLLECTION SEARCH ───────────────────────────────────────────────────────
  } else if (intent === "collection_search") {
    const handle = guessCollectionHandle(cleanMessage) || "all";
    const limit = settings?.maxProducts || 5;
    const products = await getCollectionProducts(shopDomain, handle, limit);

    if (products.length) {
      reply = ok(
        `Here are products from our **${handle.replace(/-/g, " ")}** collection:`,
        "product_cards",
        { products },
        {
          products,
          quickReplies: ["Show more", "Filter by price", "Filter by color"],
        },
      );
    } else {
      const fallback = await searchProducts(shopDomain, {
        searchQuery: cleanMessage,
        limit,
      });
      if (fallback.length) {
        reply = ok(
          "Here are some products you might like:",
          "product_cards",
          { products: fallback },
          { products: fallback },
        );
      } else {
        reply = ok(
          "I couldn't find that collection. Try browsing our store or searching by product name.",
          "text",
          null,
          { quickReplies: ["Best Sellers", "New Arrivals", "Search products"] },
        );
      }
    }

  // 4. COUPON VALIDATION ───────────────────────────────────────────────────────
  } else if (intent === "coupon_validate") {
    const code = extractCouponCode(cleanMessage.toUpperCase());
    if (code) {
      const result = await validateCoupon(shopDomain, code);
      if (result.valid) {
        reply = ok(
          `Great news! Coupon **${code}** is valid.`,
          "coupon_result",
          result,
          {
            quickReplies: ["Apply now", "View cart", "Any other offers?"],
          },
        );
      } else {
        reply = ok(
          `Sorry, coupon **${code}** is not valid. ${result.reason || ""}`,
          "coupon_result",
          { ...result, code },
          {
            quickReplies: ["Show active offers", "Try another code"],
          },
        );
      }
    } else {
      reply = ok("Please share the coupon code you want to check (e.g., SAVE10).");
    }

  // 5. DISCOUNT LIST ───────────────────────────────────────────────────────────
  } else if (intent === "discount_list") {
    const discounts = await getActiveDiscounts(shopDomain);
    if (discounts.length) {
      reply = ok(
        "Here are the active offers available right now:",
        "discount_list",
        { discounts },
        {
          quickReplies: discounts.slice(0, 3).map((d) => d.code),
        },
      );
    } else {
      reply = ok(
        "There are no active coupon codes at the moment. Stay tuned — we update offers regularly!",
        "text",
        null,
        { quickReplies: ["Product search", "New arrivals"] },
      );
    }

  // 6. COD INFO ────────────────────────────────────────────────────────────────
  } else if (intent === "cod_info") {
    reply = ok(
      "Yes, Cash on Delivery (COD) is available for eligible orders and locations. During checkout, select COD as your payment method.",
      "shipping_info",
      {
        items: [
          { icon: "💵", label: "Cash on Delivery (COD)", value: "Available at checkout" },
          { icon: "📍", label: "Availability", value: "Depends on your pincode" },
          { icon: "ℹ️", label: "Note", value: "COD charges may apply for some areas" },
        ],
      },
      { quickReplies: ["Shipping charges?", "Delivery time?", "Track order"] },
    );

  // 7. SHIPPING COST ───────────────────────────────────────────────────────────
  } else if (intent === "shipping_cost") {
    const meta2 = await getShopMeta(shopDomain);
    reply = ok(
      "Here's a summary of our shipping information:",
      "shipping_info",
      {
        items: [
          { icon: "🚚", label: "Standard Shipping", value: "₹99 – ₹149 depending on location" },
          { icon: "🎁", label: "Free Shipping", value: "On orders above ₹2,999" },
          { icon: "⚡", label: "Express Delivery", value: "Available for select pincodes" },
          { icon: "💵", label: "COD", value: "Available — COD charges may apply" },
        ],
        policy: meta2.shippingPolicy ? meta2.shippingPolicy.slice(0, 300) + "..." : null,
      },
      { quickReplies: ["Free shipping threshold?", "COD available?", "Delivery time?"] },
    );

  // 8. DELIVERY ETA ────────────────────────────────────────────────────────────
  } else if (intent === "delivery_eta") {
    reply = ok(
      "Delivery time depends on your location:",
      "shipping_info",
      {
        items: [
          { icon: "🏙️", label: "Metro Cities", value: "2–3 business days" },
          { icon: "🌆", label: "Tier 2/3 Cities", value: "4–6 business days" },
          { icon: "🏡", label: "Rural Areas", value: "5–7 business days" },
          { icon: "⚡", label: "Express Delivery", value: "1–2 days (select cities)" },
        ],
      },
      { quickReplies: ["Track my order", "Shipping charges?", "COD available?"] },
    );

  // 9. GENERAL SHIPPING ────────────────────────────────────────────────────────
  } else if (intent === "shipping_info") {
    reply = ok(
      "Here's what you need to know about shipping:",
      "shipping_info",
      {
        items: [
          { icon: "🚚", label: "Delivery", value: "3–7 business days" },
          { icon: "🎁", label: "Free Shipping", value: "Above ₹2,999" },
          { icon: "💵", label: "COD", value: "Available" },
          { icon: "📍", label: "Pan-India", value: "We ship across India" },
        ],
      },
      { quickReplies: ["Track order", "Shipping charges", "Delivery time"] },
    );

  // 10. GIFT PRODUCTS ──────────────────────────────────────────────────────────
  } else if (intent === "gift_info") {
    // Search for gift/freebie tagged products
    const gifts = await searchProducts(shopDomain, {
      searchQuery: "gift",
      inStock: true,
      limit: 4,
    });
    if (gifts.length) {
      reply = ok(
        "Here are available gift products — free or discounted!",
        "gift_products",
        {
          products: gifts,
          threshold: 2999,
          thresholdFormatted: "₹2,999",
          instructions: "Add items worth ₹2,999 or more to unlock a free gift during checkout.",
        },
        {
          products: gifts,
          quickReplies: ["How to claim?", "Add to cart", "Show more gifts"],
        },
      );
    } else {
      reply = ok(
        "Gift promotions depend on your cart value. Add products worth ₹2,999 or more to unlock a free gift at checkout!",
        "shipping_info",
        {
          items: [
            { icon: "🎁", label: "Gift Eligibility", value: "Cart value ≥ ₹2,999" },
            { icon: "✨", label: "How to claim", value: "Automatically added at checkout" },
            { icon: "📦", label: "Availability", value: "While stocks last" },
          ],
        },
        { quickReplies: ["Shop now", "Check cart", "Track order"] },
      );
    }

  // 11. CART SUMMARY ───────────────────────────────────────────────────────────
  } else if (intent === "cart_summary") {
    reply = ok(
      "Your cart details are available on the store. Click the button below to view or checkout:",
      "cart_action",
      {
        checkoutUrl: "/checkout",
        cartUrl: "/cart",
        message: "View your cart to see items, update quantities, and proceed to checkout.",
      },
      { quickReplies: ["Proceed to checkout", "View products", "Discounts?"] },
    );

  // 12. RETURNS ────────────────────────────────────────────────────────────────
  } else if (intent === "returns") {
    reply = ok(
      "Here's our returns & refund policy:",
      "shipping_info",
      {
        items: [
          { icon: "🔄", label: "Return Window", value: "7 days from delivery" },
          { icon: "✅", label: "Eligible Items", value: "Unused, original packaging" },
          { icon: "💰", label: "Refund Mode", value: "Original payment method (3–5 days)" },
          { icon: "📧", label: "Initiate Return", value: "Email support with order number" },
        ],
      },
      { quickReplies: ["Track my order", "Contact Support", "Exchange policy?"] },
    );

  // 13. RECOMMENDATION ─────────────────────────────────────────────────────────
  } else if (intent === "recommendation") {
    const params = extractProductParams(cleanMessage);
    const products = await searchProducts(shopDomain, {
      searchQuery: params.searchQuery || "popular",
      limit: settings?.maxProducts || 5,
    });
    if (products.length) {
      reply = ok(
        "Here are some products you might love:",
        "product_cards",
        { products },
        {
          products,
          quickReplies: ["Show more", "Best sellers", "New arrivals"],
        },
      );
    } else {
      reply = ok(
        "I'd love to suggest some products! What category or type of product are you looking for?",
        "text",
        null,
        { quickReplies: ["Clothing", "Electronics", "Best Sellers", "New Arrivals"] },
      );
    }

  // 14. HUMAN HANDOFF ──────────────────────────────────────────────────────────
  } else if (intent === "human") {
    handoff = true;
    reply = ok(
      "I'll connect you with our support team. Please share your order number and email, and a team member will follow up shortly.",
      "text",
      null,
      { quickReplies: ["Track order", "Returns policy", "Continue chatting"] },
    );

  // 15. GENERAL ────────────────────────────────────────────────────────────────
  } else {
    // Try a product search as fallback for short queries
    if (cleanMessage.length < 40) {
      const products = await searchProducts(shopDomain, {
        searchQuery: cleanMessage,
        limit: 3,
      });
      if (products.length) {
        reply = ok(
          `Here are some products related to "${cleanMessage}":`,
          "product_cards",
          { products },
          { products },
        );
      }
    }

    if (!reply) {
      reply = ok(
        settings?.welcomeMessage ||
          "I can help with order tracking, product search, shipping, discounts, and more. What would you like to know?",
        "text",
        null,
        {
          quickReplies: [
            "Track my order",
            "Product search",
            "Discounts?",
            "Shipping info",
          ],
        },
      );
    }
  }

  // ── Persist bot reply ──
  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      shopId: shop.id,
      role: "BOT",
      type: messageType,
      body: reply.text,
      payload: {
        source: "chatbot-module",
        intent,
        responseType: reply.type,
      },
    },
  });

  // ── Update conversation state ──
  const updatedMeta = {
    ...meta,
    flowState: nextFlowState,
    lastIntent: intent,
  };

  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      firstResponseAt: conversation.firstResponseAt || new Date(),
      handoffRequested: handoff,
      handoffReason: handoff ? "USER_REQUEST" : null,
      status: handoff ? "PENDING" : "ACTIVE",
      customerEmail: detectedLead.email || conversation.customerEmail || null,
      customerPhone: detectedLead.phone || conversation.customerPhone || null,
      metadata: updatedMeta,
    },
  });

  await db.conversationEvent.create({
    data: {
      shopId: shop.id,
      conversationId: conversation.id,
      type: handoff ? "HANDOFF_TRIGGERED" : "MESSAGE_SENT",
      details: { source: "api/chat", intent },
    },
  });

  return reply;
}

export async function getOnboardingProgress(shopDomain) {
  const shop = await db.shop.findUnique({
    where: { shop: shopDomain },
    include: { onboardingProgress: true },
  });
  return shop?.onboardingProgress || null;
}
