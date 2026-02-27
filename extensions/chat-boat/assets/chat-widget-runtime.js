(() => {
  const root = document.getElementById("pcb-root");
  if (!root || root.dataset.initialized === "true") {
    return;
  }
  root.dataset.initialized = "true";

  const config = buildConfig(root);
  applyTheme(root, config);

  const state = {
    open: false,
    busy: false,
    unread: 0,
    history: loadHistory(config.storageKey),
    products: [],
    resources: [],
  };

  const ui = renderBaseUI(config);
  root.appendChild(ui.toggleButton);
  root.appendChild(ui.panel);

  if (state.history.length === 0) {
    pushMessage(state, config, "bot", config.welcomeMessage, false);
    pushMessage(
      state,
      config,
      "bot",
      "Ask about order tracking, product search, discount offers, shipping, or store policies.",
      false
    );
  }

  renderMessages(ui.messages, state.history, config.botInitials);
  renderQuickReplies(ui.quickReplies, config.quickReplies, sendUserMessage);
  renderProducts(ui.productsTrack, state.products);
  renderResources(ui.resourcesList, state.resources);
  syncBadge(ui.badge, state.unread);
  syncSendState(ui.input, ui.sendButton, state.busy);

  wireEvents();
  updateMobileVisibility();

  if (config.autoOpen) {
    setTimeout(() => {
      toggleOpen(true);
    }, 300);
  }

  function wireEvents() {
    ui.toggleButton.addEventListener("click", () => {
      toggleOpen(!state.open);
    });

    ui.closeButton.addEventListener("click", () => {
      toggleOpen(false);
    });

    ui.clearButton.addEventListener("click", () => {
      clearConversation();
    });

    ui.sendButton.addEventListener("click", () => {
      void sendUserMessage(ui.input.value);
    });

    ui.input.addEventListener("input", () => {
      syncSendState(ui.input, ui.sendButton, state.busy);
    });

    ui.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendUserMessage(ui.input.value);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open) {
        toggleOpen(false);
      }
    });

    window.addEventListener("resize", updateMobileVisibility);
  }

  function updateMobileVisibility() {
    const isMobile = window.matchMedia("(max-width: 480px)").matches;
    const shouldHide = isMobile && !config.showOnMobile;
    root.classList.toggle("pcb-hidden", shouldHide);
    if (shouldHide) {
      toggleOpen(false);
    }
  }

  function toggleOpen(nextOpen) {
    state.open = nextOpen;
    ui.toggleButton.classList.toggle("pcb-open", nextOpen);
    ui.panel.classList.toggle("pcb-open", nextOpen);
    ui.toggleButton.setAttribute("aria-expanded", String(nextOpen));

    if (nextOpen) {
      state.unread = 0;
      syncBadge(ui.badge, state.unread);
      setTimeout(() => {
        ui.input.focus();
      }, 30);
      scrollMessagesToBottom(ui.messages);
    }
  }

  function clearConversation() {
    state.history = [];
    state.products = [];
    state.resources = [];
    state.unread = 0;
    pushMessage(state, config, "bot", config.welcomeMessage, false);
    pushMessage(
      state,
      config,
      "bot",
      "Ask about order tracking, product search, discount offers, shipping, or store policies.",
      false
    );
    syncBadge(ui.badge, state.unread);
    renderMessages(ui.messages, state.history, config.botInitials);
    renderProducts(ui.productsTrack, state.products);
    renderResources(ui.resourcesList, state.resources);
  }

  async function sendUserMessage(rawText) {
    const text = (rawText || "").trim();
    if (!text || state.busy) {
      return;
    }

    state.busy = true;
    syncSendState(ui.input, ui.sendButton, state.busy);

    ui.input.value = "";
    syncSendState(ui.input, ui.sendButton, state.busy);

    pushMessage(state, config, "user", text, true);
    renderMessages(ui.messages, state.history, config.botInitials);
    scrollMessagesToBottom(ui.messages);

    showTyping(ui.typing, true);

    let botReply = null;
    try {
      botReply = await fetchBotReply(config, state.history, text);
    } catch (_error) {
      botReply = await safeFallbackReply(text);
    }

    showTyping(ui.typing, false);

    if (!botReply || !botReply.text) {
      botReply = await safeFallbackReply(text);
    }

    state.products = await resolveProductsForSlider(text, botReply.products || []);
    state.resources = (botReply.resources || []).slice(0, 6);
    renderProducts(ui.productsTrack, state.products);
    renderResources(ui.resourcesList, state.resources);

    pushMessage(state, config, "bot", botReply.text, !state.open);
    syncBadge(ui.badge, state.unread);
    renderMessages(ui.messages, state.history, config.botInitials);
    scrollMessagesToBottom(ui.messages);

    state.busy = false;
    syncSendState(ui.input, ui.sendButton, state.busy);
    ui.input.focus();
}

const PCB_DEFAULT_QUICK_REPLIES = [
  "Order tracking",
  "Product search",
  "Discount offers",
  "Shipping info",
  "Store policies",
];

const pcbCache = {
  products: null,
  searchResults: new Map(),
  pathStatus: new Map(),
  policySnippet: new Map(),
};

function buildConfig(root) {
  const data = root.dataset;
  const color = sanitizeColor(data.color || "#008060");
  const shop = (data.shop || window.location.hostname || "shop").toLowerCase();
  const quickReplies = parseQuickReplies(data.quickReplies);

  return {
    botName: (data.botName || "Shop Assistant").trim(),
    botInitials: getInitials(data.botName || "Shop Assistant"),
    welcomeMessage: (data.welcome || "Hi! Ask me about products, pricing, or recommendations.").trim(),
    primaryColor: color,
    primaryColorDark: darkenColor(color, 20),
    buttonSize: clampNumber(parseInt(data.btnSize || "56", 10), 44, 72, 56),
    autoOpen: parseBoolean(data.autoOpen),
    showOnMobile: data.showMobile !== undefined ? parseBoolean(data.showMobile) : true,
    shop,
    apiUrl: normalizeApiBaseUrl(data.apiUrl),
    quickReplies: quickReplies.length ? quickReplies : PCB_DEFAULT_QUICK_REPLIES,
    storageKey: `pcb-history:${shop}`,
  };
}

function applyTheme(root, config) {
  root.style.setProperty("--pcb-color", config.primaryColor);
  root.style.setProperty("--pcb-color-dark", config.primaryColorDark);
  root.style.setProperty("--pcb-btn-size", `${config.buttonSize}px`);
}

function renderBaseUI(config) {
  const toggleButton = createElement("button", "pcb-toggle", {
    type: "button",
    "aria-label": "Toggle chat widget",
    "aria-expanded": "false",
  });

  const chatIcon = iconNode(
    "pcb-toggle-icon pcb-toggle-icon--chat",
    "M12 3C7.03 3 3 6.58 3 11c0 2.12.94 4.05 2.47 5.49L5 21l4.1-2.23c.91.25 1.88.38 2.9.38 4.97 0 9-3.58 9-8s-4.03-8.15-9-8.15Zm-3.2 9.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z"
  );
  const closeIcon = iconNode(
    "pcb-toggle-icon pcb-toggle-icon--close",
    "M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"
  );

  const badge = createElement("span", "pcb-badge pcb-hidden", {
    "aria-live": "polite",
    "aria-label": "Unread messages",
  });
  badge.textContent = "0";

  toggleButton.appendChild(chatIcon);
  toggleButton.appendChild(closeIcon);
  toggleButton.appendChild(badge);

  const panel = createElement("section", "pcb-panel", { "aria-label": "Chat panel" });
  const header = createElement("div", "pcb-header");
  const headerLeft = createElement("div", "pcb-header-left");
  const avatar = createElement("div", "pcb-avatar");
  avatar.textContent = config.botInitials;

  const headerText = createElement("div", "pcb-header-text");
  const headerName = createElement("p", "pcb-header-name");
  headerName.textContent = config.botName;
  const headerStatus = createElement("p", "pcb-header-status");
  headerStatus.textContent = "Online now";
  headerText.appendChild(headerName);
  headerText.appendChild(headerStatus);
  headerLeft.appendChild(avatar);
  headerLeft.appendChild(headerText);

  const headerActions = createElement("div", "");
  headerActions.style.display = "flex";
  headerActions.style.gap = "6px";

  const clearButton = createElement("button", "pcb-header-btn", {
    type: "button",
    "aria-label": "Clear conversation",
    title: "Clear conversation",
  });
  clearButton.appendChild(iconNode("", "M5 5h14v2H5V5Zm1 4h12l-1 11H7L6 9Zm4-6h4l1 1h4v2H5V4h4l1-1Z"));

  const closeButton = createElement("button", "pcb-header-btn", {
    type: "button",
    "aria-label": "Close chat",
    title: "Close chat",
  });
  closeButton.appendChild(iconNode("", "M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"));

  headerActions.appendChild(clearButton);
  headerActions.appendChild(closeButton);
  header.appendChild(headerLeft);
  header.appendChild(headerActions);

  const messages = createElement("div", "pcb-messages");

  const typing = createElement("div", "pcb-typing pcb-hidden");
  const typingAvatar = createElement("div", "pcb-msg-avatar");
  typingAvatar.textContent = config.botInitials;
  const typingBubble = createElement("div", "pcb-typing-bubble");
  typingBubble.appendChild(createElement("span", "pcb-typing-dot"));
  typingBubble.appendChild(createElement("span", "pcb-typing-dot"));
  typingBubble.appendChild(createElement("span", "pcb-typing-dot"));
  typing.appendChild(typingAvatar);
  typing.appendChild(typingBubble);

  const quickReplies = createElement("div", "pcb-quick-replies");
  const products = createElement("div", "pcb-products pcb-hidden");
  const productsLabel = createElement("div", "pcb-products-label");
  productsLabel.textContent = "Recommended products";
  const productsTrack = createElement("div", "pcb-products-track");
  products.appendChild(productsLabel);
  products.appendChild(productsTrack);

  const resources = createElement("div", "pcb-resources pcb-hidden");
  const resourcesLabel = createElement("div", "pcb-resources-label");
  resourcesLabel.textContent = "Helpful store links";
  const resourcesList = createElement("div", "pcb-resources-list");
  resources.appendChild(resourcesLabel);
  resources.appendChild(resourcesList);

  const inputRow = createElement("div", "pcb-input-row");
  const input = createElement("input", "pcb-input", {
    type: "text",
    placeholder: "Ask about order, product, discount, shipping...",
    maxlength: "400",
    "aria-label": "Message",
  });
  const sendButton = createElement("button", "pcb-send", { type: "button", "aria-label": "Send message" });
  sendButton.appendChild(iconNode("", "M2 21 23 12 2 3v7l15 2-15 2z"));
  inputRow.appendChild(input);
  inputRow.appendChild(sendButton);

  const footer = createElement("div", "pcb-footer");
  footer.textContent = "Powered by Chat Boat";

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(typing);
  panel.appendChild(quickReplies);
  panel.appendChild(products);
  panel.appendChild(resources);
  panel.appendChild(inputRow);
  panel.appendChild(footer);

  return {
    toggleButton,
    badge,
    panel,
    closeButton,
    clearButton,
    messages,
    typing,
    quickReplies,
    products,
    productsTrack,
    resources,
    resourcesList,
    input,
    sendButton,
  };
}

function renderMessages(container, history, botInitials) {
  container.innerHTML = "";
  history.forEach((entry) => {
    const role = entry.role === "user" ? "user" : "bot";
    const item = createElement("div", `pcb-msg-item pcb-msg-item--${role}`);
    const row = createElement("div", `pcb-msg pcb-msg--${role}`);
    const avatar = createElement("div", "pcb-msg-avatar");
    avatar.textContent = role === "user" ? "Y" : botInitials;

    const bubble = createElement("div", "pcb-bubble");
    bubble.textContent = entry.text;
    row.appendChild(avatar);
    row.appendChild(bubble);

    const meta = createElement("div", "pcb-msg-meta");
    const time = createElement("span", "pcb-msg-time");
    time.textContent = formatClock(entry.timestamp);
    meta.appendChild(time);

    item.appendChild(row);
    item.appendChild(meta);
    container.appendChild(item);
  });
}

function renderQuickReplies(container, replies, onReply) {
  container.innerHTML = "";
  if (!replies.length) {
    container.classList.add("pcb-hidden");
    return;
  }

  replies.forEach((replyText) => {
    const chip = createElement("button", "pcb-chip", {
      type: "button",
      "aria-label": `Quick reply: ${replyText}`,
    });
    chip.textContent = replyText;
    chip.addEventListener("click", () => {
      void onReply(replyText);
    });
    container.appendChild(chip);
  });
  container.classList.remove("pcb-hidden");
}

function renderProducts(track, products) {
  track.innerHTML = "";
  const parent = track.parentElement;
  if (!parent) {
    return;
  }

  if (!products.length) {
    parent.classList.add("pcb-hidden");
    return;
  }

  products.forEach((product) => {
    const card = createElement("a", "pcb-product-card", {
      href: product.url || "#",
      title: product.title || "Product",
    });

    if (product.image) {
      const image = createElement("img", "pcb-product-img", {
        src: product.image,
        alt: product.title || "Product image",
        loading: "lazy",
      });
      card.appendChild(image);
    } else {
      const placeholder = createElement("div", "pcb-product-img-placeholder");
      placeholder.textContent = "P";
      card.appendChild(placeholder);
    }

    const info = createElement("div", "pcb-product-info");
    const title = createElement("div", "pcb-product-title");
    title.textContent = product.title || "Product";
    const price = createElement("div", "pcb-product-price");
    price.textContent = product.price || "";
    info.appendChild(title);
    if (product.price) {
      info.appendChild(price);
    }
    card.appendChild(info);

    const cta = createElement("span", "pcb-product-btn");
    cta.textContent = "View product";
    card.appendChild(cta);

    track.appendChild(card);
  });

  parent.classList.remove("pcb-hidden");
}

function renderResources(list, resources) {
  list.innerHTML = "";
  const parent = list.parentElement;
  if (!parent) {
    return;
  }

  if (!resources.length) {
    parent.classList.add("pcb-hidden");
    return;
  }

  resources.forEach((resource) => {
    const card = createElement("a", "pcb-resource-card", {
      href: resource.url || "#",
      title: resource.title || "Store link",
    });

    const top = createElement("div", "pcb-resource-top");
    const title = createElement("div", "pcb-resource-title");
    title.textContent = resource.title || "Store link";
    const type = createElement("span", "pcb-resource-type");
    type.textContent = resource.type || "Info";
    top.appendChild(title);
    top.appendChild(type);

    card.appendChild(top);

    if (resource.description) {
      const description = createElement("div", "pcb-resource-desc");
      description.textContent = resource.description;
      card.appendChild(description);
    }

    list.appendChild(card);
  });

  parent.classList.remove("pcb-hidden");
}

async function fetchBotReply(config, history, userText) {
  if (config.apiUrl) {
    const apiReply = await requestReplyFromApi(config, history, userText);
    if (apiReply) {
      return apiReply;
    }
  }

  return fallbackReply(userText);
}

async function requestReplyFromApi(config, history, userText) {
  const endpoints = buildCandidateEndpoints(config.apiUrl);
  const payload = {
    shop: config.shop,
    message: userText,
    history: history.slice(-12),
    source: "storefront-widget",
  };

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const text = normalizeReplyText(data);
      if (!text) {
        continue;
      }

      return {
        text,
        products: normalizeProducts(data.products || data.recommendations || []),
        resources: normalizeResources(data.resources || data.links || []),
      };
    } catch (_error) {
      continue;
    }
  }

  return null;
}

async function safeFallbackReply(userText) {
  try {
    const reply = await fallbackReply(userText);
    if (reply && reply.text) {
      return reply;
    }
  } catch (_error) {
    // Ignore and return a deterministic emergency reply below.
  }

  const query = String(userText || "").trim();
  return {
    text: query
      ? `I could not process "${query}" right now. Try asking about products, discounts, shipping, or order tracking.`
      : "I could not process that right now. Try asking about products, discounts, shipping, or order tracking.",
    products: [],
    resources: [],
  };
}

async function resolveProductsForSlider(userText, replyProducts) {
  const limit = 5;
  const query = String(userText || "").trim();
  const normalizedReplyProducts = normalizeProducts(
    Array.isArray(replyProducts) ? replyProducts : [],
  );

  if (normalizedReplyProducts.length >= limit) {
    return normalizedReplyProducts.slice(0, limit);
  }

  const related = query ? await searchStorefrontProducts(query) : [];
  let merged = mergeUniqueProducts(normalizedReplyProducts, related, limit);

  if (merged.length < limit) {
    merged = mergeUniqueProducts(merged, await getTopProducts(), limit);
  }

  return merged;
}

function mergeUniqueProducts(primaryProducts, secondaryProducts, limit) {
  const output = [];
  const seen = new Set();
  const max = Math.max(1, Number(limit) || 5);

  const pushUnique = (product) => {
    if (!product || !product.title) {
      return;
    }
    const key = String(product.url || product.title).toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    output.push(product);
  };

  (primaryProducts || []).forEach(pushUnique);
  (secondaryProducts || []).forEach(pushUnique);
  return output.slice(0, max);
}

function buildCandidateEndpoints(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/+$/, "");
  if (!normalized) {
    return [];
  }
  if (/\/chat$/i.test(normalized)) {
    return [normalized];
  }
  return [
    `${normalized}/apps/chatboat/chat`,
    `${normalized}/api/chat`,
    `${normalized}/chat`,
  ];
}

async function fallbackReply(userText) {
  const query = String(userText || "").trim();
  const intent = detectIntent(query);

  if (intent === "order") {
    return orderTrackingReply();
  }
  if (intent === "discount") {
    return discountReply(query);
  }
  if (intent === "shipping") {
    return shippingReply();
  }
  if (intent === "store") {
    return storeSearchReply(query);
  }
  if (intent === "product") {
    return productReply(query);
  }

  return generalSearchReply(query);
}

function detectIntent(text) {
  const query = String(text || "").toLowerCase();
  if (matchesAny(query, ["order", "track", "tracking", "where is my order", "awb"])) {
    return "order";
  }
  if (matchesAny(query, ["discount", "coupon", "promo", "offer", "sale", "% off"])) {
    return "discount";
  }
  if (matchesAny(query, ["shipping", "delivery", "dispatch", "courier", "eta"])) {
    return "shipping";
  }
  if (matchesAny(query, ["policy", "return", "refund", "contact", "about", "store", "faq"])) {
    return "store";
  }
  if (matchesAny(query, ["product", "search", "find", "show", "buy", "item", "collection"])) {
    return "product";
  }
  return "general";
}

async function orderTrackingReply() {
  const resources = await collectKnownResources([
    { title: "Track your order", type: "Tracking", paths: ["/pages/track-order", "/pages/order-tracking", "/pages/track"] },
    { title: "Your account orders", type: "Account", paths: ["/account"] },
    { title: "Contact support", type: "Support", paths: ["/pages/contact", "/contact"] },
  ]);

  return {
    text: resources.length
      ? "Use the links below to track your order and get latest shipping status."
      : "Please log in to your account orders page or contact support with your order number.",
    products: [],
    resources,
  };
}

async function productReply(query) {
  const products = await searchStorefrontProducts(query);
  if (products.length) {
    return {
      text: `I found ${products.length} products for "${query}".`,
      products,
      resources: [],
    };
  }

  return {
    text: "I could not find an exact match. Here are products from the store.",
    products: await getTopProducts(),
    resources: [],
  };
}

async function discountReply(query) {
  const products = await findDiscountedProducts(query);
  const resources = await collectKnownResources([
    { title: "View all products", type: "Catalog", paths: ["/collections/all"] },
  ]);

  if (products.length) {
    return {
      text: "I found discounted products currently available.",
      products,
      resources,
    };
  }

  return {
    text: "I could not detect discounted products right now from storefront data.",
    products: [],
    resources,
  };
}

async function shippingReply() {
  const resources = await collectKnownResources([
    { title: "Shipping policy", type: "Policy", paths: ["/policies/shipping-policy"] },
    { title: "Return policy", type: "Policy", paths: ["/policies/refund-policy", "/policies/return-policy"] },
    { title: "Contact support", type: "Support", paths: ["/pages/contact", "/contact"] },
  ]);
  const snippet = await fetchPolicySnippet("/policies/shipping-policy");

  return {
    text: snippet
      ? `Shipping details: ${snippet}`
      : "Shipping timelines depend on location and courier. Open shipping policy for full details.",
    products: [],
    resources,
  };
}

async function storeSearchReply(query) {
  const results = await searchStorefrontResources(query);
  if (results.products.length || results.resources.length) {
    return {
      text: `I found store results for "${query}".`,
      products: results.products,
      resources: results.resources,
    };
  }

  return {
    text: "No exact store result found. Try keywords like return policy, contact, or shipping.",
    products: [],
    resources: await collectKnownResources([
      { title: "Contact us", type: "Support", paths: ["/pages/contact", "/contact"] },
      { title: "All collections", type: "Catalog", paths: ["/collections/all"] },
    ]),
  };
}

async function generalSearchReply(query) {
  if (!query) {
    return {
      text: "Ask me about order tracking, products, discounts, shipping, or store policies.",
      products: [],
      resources: [],
    };
  }

  const results = await searchStorefrontResources(query);
  if (results.products.length || results.resources.length) {
    return {
      text: `Here is what I found for "${query}".`,
      products: results.products,
      resources: results.resources,
    };
  }

  return {
    text: "I could not find relevant results. Try a more specific query.",
    products: [],
    resources: [],
  };
}

async function searchStorefrontResources(queryText) {
  const query = String(queryText || "").trim();
  if (!query) {
    return { products: [], resources: [] };
  }

  const key = query.toLowerCase();
  if (pcbCache.searchResults.has(key)) {
    return pcbCache.searchResults.get(key);
  }

  try {
    const url = `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,page,collection,article&resources[limit]=6&resources[options][unavailable_products]=last`;
    const response = await fetch(url);
    if (!response.ok) {
      const fallback = { products: await searchStorefrontProducts(query), resources: [] };
      pcbCache.searchResults.set(key, fallback);
      return fallback;
    }

    const data = await response.json();
    const results = data && data.resources && data.resources.results ? data.resources.results : {};
    const products = normalizePredictiveProducts(results.products || []).slice(0, 5);
    const pages = normalizeLinkResources(results.pages || [], "Page");
    const collections = normalizeLinkResources(results.collections || [], "Collection");
    const articles = normalizeLinkResources(results.articles || [], "Article");
    const shaped = {
      products,
      resources: [...pages, ...collections, ...articles].slice(0, 6),
    };

    pcbCache.searchResults.set(key, shaped);
    return shaped;
  } catch (_error) {
    const fallback = { products: await searchStorefrontProducts(query), resources: [] };
    pcbCache.searchResults.set(key, fallback);
    return fallback;
  }
}

function normalizePredictiveProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) {
    return [];
  }

  return rawProducts.map((item) => {
    const minPrice = item && item.price ? item.price.min_variant_price : null;
    const price = minPrice && minPrice.amount
      ? `${minPrice.currency_code || ""} ${minPrice.amount}`.trim()
      : "";
    return {
      title: item.title || "Product",
      url: item.url || "#",
      image: item.featured_image && item.featured_image.url ? item.featured_image.url : "",
      price,
    };
  });
}

function normalizeLinkResources(items, type) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    title: item.title || type,
    url: item.url || "#",
    type,
    description: "Open details",
  }));
}

async function getTopProducts() {
  const products = await fetchStoreProducts();
  return products.slice(0, 5).map((product) => normalizeStorefrontProduct(product));
}

async function searchStorefrontProducts(queryText) {
  const query = String(queryText || "").trim();
  const products = await fetchStoreProducts();
  if (!products.length) {
    return [];
  }

  if (!query) {
    return products.slice(0, 5).map((product) => normalizeStorefrontProduct(product));
  }

  const tokens = tokenize(query);
  if (!tokens.length) {
    return [];
  }

  return products
    .map((product) => ({
      product,
      score: scoreProduct(product, tokens),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => normalizeStorefrontProduct(row.product));
}

async function findDiscountedProducts(queryText) {
  const products = await fetchStoreProducts();
  const tokens = tokenize(queryText || "");

  return products
    .map((product) => {
      const variant = Array.isArray(product.variants) && product.variants.length ? product.variants[0] : null;
      if (!variant) {
        return null;
      }

      const price = Number(variant.price || 0);
      const compareAt = Number(variant.compare_at_price || 0);
      if (!(compareAt > price && price > 0)) {
        return null;
      }

      if (tokens.length && scoreProduct(product, tokens) === 0) {
        return null;
      }

      return {
        product,
        saved: compareAt - price,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 5)
    .map((row) => {
      const normalized = normalizeStorefrontProduct(row.product);
      return {
        ...normalized,
        price: `${normalized.price} (Save ${formatPrice(row.saved)})`,
      };
    });
}

async function fetchStoreProducts() {
  if (Array.isArray(pcbCache.products)) {
    return pcbCache.products;
  }

  try {
    const response = await fetch("/products.json?limit=120");
    if (!response.ok) {
      pcbCache.products = [];
      return pcbCache.products;
    }
    const data = await response.json();
    pcbCache.products = Array.isArray(data.products) ? data.products : [];
    return pcbCache.products;
  } catch (_error) {
    pcbCache.products = [];
    return pcbCache.products;
  }
}

async function collectKnownResources(definitions) {
  const resources = [];
  for (const definition of definitions) {
    const path = await findFirstReachablePath(definition.paths || []);
    if (!path) {
      continue;
    }
    resources.push({
      title: definition.title,
      type: definition.type || "Info",
      url: path,
      description: `Open ${definition.title.toLowerCase()}`,
    });
  }
  return resources;
}

async function findFirstReachablePath(paths) {
  for (const path of paths) {
    if (!path) {
      continue;
    }

    if (pcbCache.pathStatus.has(path)) {
      if (pcbCache.pathStatus.get(path)) {
        return path;
      }
      continue;
    }

    try {
      const response = await fetch(path);
      const ok = response.ok;
      pcbCache.pathStatus.set(path, ok);
      if (ok) {
        return path;
      }
    } catch (_error) {
      pcbCache.pathStatus.set(path, false);
    }
  }
  return "";
}

async function fetchPolicySnippet(path) {
  if (pcbCache.policySnippet.has(path)) {
    return pcbCache.policySnippet.get(path);
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      pcbCache.policySnippet.set(path, "");
      return "";
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const text = (doc.body && doc.body.textContent ? doc.body.textContent : "")
      .replace(/\s+/g, " ")
      .trim();
    const snippet = text.length > 220 ? `${text.slice(0, 220)}...` : text;
    pcbCache.policySnippet.set(path, snippet);
    return snippet;
  } catch (_error) {
    pcbCache.policySnippet.set(path, "");
    return "";
  }
}

function normalizeStorefrontProduct(product) {
  const variant = Array.isArray(product.variants) && product.variants.length ? product.variants[0] : null;
  const rawPrice = variant && variant.price ? Number(variant.price) : 0;
  const handle = product.handle || "";
  const image = Array.isArray(product.images) && product.images.length ? product.images[0] : "";

  return {
    title: product.title || "Product",
    price: rawPrice > 0 ? formatPrice(rawPrice) : "",
    url: handle ? `/products/${handle}` : "#",
    image: typeof image === "string" ? image : "",
  };
}

function scoreProduct(product, tokens) {
  const haystack = [
    product.title,
    product.product_type,
    product.vendor,
    product.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += token.length > 4 ? 2 : 1;
    }
  });
  return score;
}

function normalizeProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) {
    return [];
  }

  return rawProducts
    .map((item) => {
      const title = item.title || item.name || "";
      const url = item.url || item.link || "#";
      const image = item.image || item.imageUrl || item.thumbnail || "";
      const price = item.price || item.formattedPrice || "";
      return {
        title: String(title || "Product"),
        url: String(url || "#"),
        image: String(image || ""),
        price: String(price || ""),
      };
    })
    .filter((item) => item.title);
}

function normalizeResources(rawResources) {
  if (!Array.isArray(rawResources)) {
    return [];
  }

  return rawResources
    .map((item) => ({
      title: String(item.title || item.name || "Store link"),
      url: String(item.url || item.link || "#"),
      type: String(item.type || "Info"),
      description: String(item.description || "Open details"),
    }))
    .filter((item) => item.title && item.url);
}

function normalizeReplyText(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const direct =
    data.reply ||
    data.message ||
    data.answer ||
    data.text;

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  if (Array.isArray(data.messages)) {
    const botMessage = data.messages.find((message) => message && message.role === "assistant");
    if (botMessage && typeof botMessage.content === "string") {
      return botMessage.content.trim();
    }
  }

  return "";
}

function pushMessage(state, config, role, text, countUnread) {
  const entry = {
    role: role === "user" ? "user" : "bot",
    text: String(text || "").trim(),
    timestamp: Date.now(),
  };
  if (!entry.text) {
    return;
  }

  state.history.push(entry);
  state.history = state.history.slice(-40);
  saveHistory(config.storageKey, state.history);

  if (countUnread && entry.role === "bot") {
    state.unread += 1;
  }
}

function loadHistory(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && (entry.role === "user" || entry.role === "bot") && typeof entry.text === "string")
      .map((entry) => ({
        role: entry.role,
        text: entry.text,
        timestamp: Number(entry.timestamp) || Date.now(),
      }))
      .slice(-40);
  } catch (_error) {
    return [];
  }
}

function saveHistory(storageKey, history) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch (_error) {
    // Ignore storage failures (private mode or quota restrictions).
  }
}

function syncBadge(badge, count) {
  if (!badge) {
    return;
  }
  badge.textContent = String(count);
  badge.classList.toggle("pcb-hidden", count <= 0);
}

function showTyping(typingNode, show) {
  if (!typingNode) {
    return;
  }
  typingNode.classList.toggle("pcb-hidden", !show);
}

function syncSendState(input, button, busy) {
  const canSend = !!input.value.trim() && !busy;
  button.disabled = !canSend;
}

function scrollMessagesToBottom(messages) {
  messages.scrollTop = messages.scrollHeight;
}

function parseQuickReplies(value) {
  if (!value || typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value || "").toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function normalizeApiBaseUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

function createElement(tagName, className, attrs) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (attrs && typeof attrs === "object") {
    Object.entries(attrs).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
  }
  return node;
}

function iconNode(className, pathD) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  if (className) {
    svg.setAttribute("class", className);
  }

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);

  return svg;
}

function sanitizeColor(value) {
  const color = String(value || "").trim();
  const hexMatch = color.match(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/);
  return hexMatch ? color : "#008060";
}

function darkenColor(hex, amountPercent) {
  const parsed = expandHex(hex);
  const amount = Math.max(0, Math.min(100, amountPercent)) / 100;
  const r = Math.max(0, Math.round(parsed.r * (1 - amount)));
  const g = Math.max(0, Math.round(parsed.g * (1 - amount)));
  const b = Math.max(0, Math.round(parsed.b * (1 - amount)));
  return rgbToHex(r, g, b);
}

function expandHex(hex) {
  const normalized = hex.replace("#", "");
  const raw = normalized.length === 3
    ? normalized
        .split("")
        .map((c) => c + c)
        .join("")
    : normalized;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function matchesAny(text, terms) {
  const source = String(text || "").toLowerCase();
  if (!source || !Array.isArray(terms)) {
    return false;
  }

  return terms.some((term) => source.includes(String(term || "").toLowerCase()));
}

function formatPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch (_error) {
    return `$${value.toFixed(2)}`;
  }
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 8);
}

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return "AI";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function clampNumber(value, min, max, fallback) {
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function formatClock(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return "";
  }
}

})();
