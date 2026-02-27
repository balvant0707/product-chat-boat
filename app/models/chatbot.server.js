import db from "../db.server";

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

const WORD_MATCHES = {
  order: ["order", "track", "tracking", "awb", "status"],
  shipping: ["shipping", "delivery", "eta", "courier", "dispatch"],
  returns: ["return", "refund", "exchange", "replace"],
  payment: ["cod", "payment", "upi", "card", "wallet"],
  discount: ["discount", "coupon", "promo", "offer", "sale"],
  human: ["human", "agent", "support", "representative", "complaint"],
};

function toWidgetPosition(value) {
  return value === "bottom-left" ? "BOTTOM_LEFT" : "BOTTOM_RIGHT";
}

function fromWidgetPosition(value) {
  return value === "BOTTOM_LEFT" ? "bottom-left" : "bottom-right";
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
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
  } catch (_error) {
    return "-";
  }
}

async function ensureShop(shopDomain) {
  if (!shopDomain) return null;
  return db.shop.upsert({
    where: { shop: shopDomain },
    create: {
      shop: shopDomain,
      installed: true,
      onboardedAt: new Date(),
    },
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
    aiConfidenceThreshold:
      aiSetting?.confidenceThreshold ?? DEFAULT_AI_VALUES.confidenceThreshold,
    isEnabled: Boolean(botSetting?.enabled),
    testModeEnabled: Boolean(botSetting?.testModeEnabled),
    showPoweredBy: Boolean(botSetting?.showPoweredBy),
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
    welcomeMessage: String(
      formValues.welcomeMessage || DEFAULT_BOT_VALUES.welcomeMessage,
    ).slice(0, 2000),
    offlineMessage: String(
      formValues.offlineMessage || DEFAULT_BOT_VALUES.offlineMessage,
    ).slice(0, 2000),
    primaryColor: normalizeColor(formValues.primaryColor, DEFAULT_BOT_VALUES.primaryColor),
    widgetPosition: toWidgetPosition(formValues.position),
    testModeEnabled: parseBoolean(formValues.testModeEnabled, false),
    showPoweredBy: parseBoolean(formValues.showPoweredBy, true),
    maxProducts: parseNumber(formValues.maxProducts, { min: 1, max: 10, fallback: 5 }),
    embedEnabled: parseBoolean(formValues.isEnabled, false),
  };

  const nextAi = {
    provider: String(formValues.aiProvider || DEFAULT_AI_VALUES.provider).slice(0, 64),
    confidenceThreshold: parseNumber(formValues.aiConfidenceThreshold, {
      min: 0,
      max: 1,
      fallback: 0.6,
    }),
    temperature: parseNumber(formValues.temperature, {
      min: 0,
      max: 1,
      fallback: 0.7,
    }),
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
      create: {
        shopId: shop.id,
        ...DEFAULT_AI_VALUES,
        ...nextAi,
        encryptedApiKey: apiKey || null,
      },
      update: {
        ...nextAi,
        ...(apiKey ? { encryptedApiKey: apiKey } : {}),
      },
    }),
    db.onboardingProgress.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, ...onboardingUpdate },
      update: onboardingUpdate,
    }),
  ]);

  return buildPublicSettings(botSetting, aiSetting);
}

function countProductsInMessages(messages) {
  return messages.reduce((total, message) => {
    if (message.type === "PRODUCT_CARD") return total + 1;
    const payloadProducts = Array.isArray(message.payload?.products)
      ? message.payload.products.length
      : 0;
    return total + payloadProducts;
  }, 0);
}

function mapConversation(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const firstUser = messages.find((message) => message.role === "USER");
  const latestLead = Array.isArray(conversation.leads) ? conversation.leads[0] : null;
  const endedAt =
    conversation.resolvedAt ||
    conversation.closedAt ||
    conversation.lastMessageAt ||
    conversation.updatedAt;

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
    thread: messages.slice(-60).map((message) => ({
      role: normalizeRole(message.role),
      text: message.body || "",
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
      leads: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return rows.map(mapConversation);
}

export function summarizeConversations(conversations) {
  const safe = Array.isArray(conversations) ? conversations : [];
  return {
    total: safe.length,
    active: safe.filter((item) => item.status === "active").length,
    pending: safe.filter((item) => item.status === "pending").length,
    resolved: safe.filter((item) => item.status === "resolved").length,
  };
}

export function buildSetupSteps({ onboardingProgress, settings, hasConversations }) {
  const progress = onboardingProgress || {};
  return [
    { id: "install", label: "Install the ChatBot app", done: Boolean(progress.stepOneInstalled), href: null },
    {
      id: "embed",
      label: "Enable app embed in theme editor",
      done: Boolean(progress.stepTwoEmbedEnabled || settings?.isEnabled),
      href: "/app/settings",
    },
    {
      id: "branding",
      label: "Configure branding and bot behavior",
      done: Boolean(progress.stepThreeBrandingDone),
      href: "/app/settings",
    },
    {
      id: "knowledge",
      label: "Enable AI mode and sync knowledge",
      done: Boolean(progress.stepFourKnowledgeReady),
      href: "/app/settings",
    },
    {
      id: "test",
      label: "Run storefront test mode",
      done: Boolean(progress.stepFiveTested || hasConversations),
      href: "/app/chat-logs",
    },
  ];
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

function detectIntent(messageText) {
  if (matchesAny(messageText, WORD_MATCHES.human)) return "human";
  if (matchesAny(messageText, WORD_MATCHES.order)) return "order";
  if (matchesAny(messageText, WORD_MATCHES.shipping)) return "shipping";
  if (matchesAny(messageText, WORD_MATCHES.returns)) return "returns";
  if (matchesAny(messageText, WORD_MATCHES.payment)) return "payment";
  if (matchesAny(messageText, WORD_MATCHES.discount)) return "discount";
  return "general";
}

function buildRuleReply(messageText, settings) {
  const intent = detectIntent(messageText);

  if (intent === "human") {
    return {
      text: "I can connect you to a support agent. Please share your order number and email, and our team will follow up.",
      handoff: true,
    };
  }
  if (intent === "order") {
    return {
      text: "Please share your order number and email (or phone). I will help with tracking and fulfillment status.",
      handoff: false,
    };
  }
  if (intent === "shipping") {
    return {
      text: "Shipping timelines vary by location. You can ask me with your city/postal code for a better ETA estimate.",
      handoff: false,
    };
  }
  if (intent === "returns") {
    return {
      text: "Returns/exchanges are handled based on store policy. Share your order number and reason, and I can guide next steps.",
      handoff: false,
    };
  }
  if (intent === "payment") {
    return {
      text: "We support standard online payment methods and optional COD (if enabled). Tell me your product and location for exact options.",
      handoff: false,
    };
  }
  if (intent === "discount") {
    return {
      text: "I can help with active offers. If available, I can share coupon guidance based on your cart value.",
      handoff: false,
    };
  }

  return {
    text:
      settings?.welcomeMessage ||
      "I can help with order tracking, shipping, returns, product questions, and connecting you to support.",
    handoff: false,
  };
}

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
    return {
      text: "Please type your message so I can help.",
      products: [],
      resources: [],
    };
  }

  const shop = await ensureShop(shopDomain);
  if (!shop) {
    return {
      text: "Store is not configured for chat yet.",
      products: [],
      resources: [],
    };
  }

  const [settings] = await Promise.all([
    getOrCreateSettings(shopDomain),
    ensureConfigRows(shop.id),
  ]);

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
        metadata: {
          initialHistoryCount: Array.isArray(history) ? history.length : 0,
        },
      },
    });
  }

  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      shopId: shop.id,
      role: "USER",
      type: "TEXT",
      body: cleanMessage,
    },
  });

  const detectedLead = detectLeadData(cleanMessage);
  if (detectedLead.email || detectedLead.phone) {
    const existingLead = await db.lead.findFirst({
      where: {
        shopId: shop.id,
        conversationId: conversation.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingLead) {
      await db.lead.update({
        where: { id: existingLead.id },
        data: {
          email: detectedLead.email || existingLead.email,
          phone: detectedLead.phone || existingLead.phone,
          tags: existingLead.tags || ["Interested"],
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

  const ruleReply = buildRuleReply(cleanMessage, settings);
  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      shopId: shop.id,
      role: "BOT",
      type: "TEXT",
      body: ruleReply.text,
      payload: {
        source: "rules-engine",
      },
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      firstResponseAt: conversation.firstResponseAt || new Date(),
      handoffRequested: ruleReply.handoff,
      handoffReason: ruleReply.handoff ? "USER_REQUEST" : null,
      status: ruleReply.handoff ? "PENDING" : "ACTIVE",
      customerEmail: detectedLead.email || conversation.customerEmail || null,
      customerPhone: detectedLead.phone || conversation.customerPhone || null,
    },
  });

  await db.conversationEvent.create({
    data: {
      shopId: shop.id,
      conversationId: conversation.id,
      type: ruleReply.handoff ? "HANDOFF_TRIGGERED" : "MESSAGE_SENT",
      details: {
        source: "api/chat",
      },
    },
  });

  return {
    text: ruleReply.text,
    products: [],
    resources: [],
  };
}

export async function getOnboardingProgress(shopDomain) {
  const shop = await db.shop.findUnique({
    where: { shop: shopDomain },
    include: { onboardingProgress: true },
  });
  return shop?.onboardingProgress || null;
}
