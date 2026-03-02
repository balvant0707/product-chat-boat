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
    resources: [],
    sessionId: config.sessionId,
    visitorId: config.visitorId,
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
      false,
    );
  }

  renderMessages(ui.messages, state.history, config.botInitials, config);
  renderQuickReplies(ui.quickReplies, config.quickReplies, sendUserMessage);
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

  // ─── Event wiring ──────────────────────────────────────────────────────────

  function wireEvents() {
    ui.toggleButton.addEventListener("click", () => toggleOpen(!state.open));
    ui.closeButton.addEventListener("click", () => toggleOpen(false));
    ui.clearButton.addEventListener("click", clearConversation);

    ui.sendButton.addEventListener("click", () => void sendUserMessage(ui.input.value));

    ui.input.addEventListener("input", () =>
      syncSendState(ui.input, ui.sendButton, state.busy),
    );

    ui.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendUserMessage(ui.input.value);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.open) toggleOpen(false);
    });

    window.addEventListener("resize", updateMobileVisibility);
  }

  function updateMobileVisibility() {
    const isMobile = window.matchMedia("(max-width: 480px)").matches;
    const shouldHide = isMobile && !config.showOnMobile;
    root.classList.toggle("pcb-hidden", shouldHide);
    if (shouldHide) toggleOpen(false);
  }

  function toggleOpen(nextOpen) {
    state.open = nextOpen;
    ui.toggleButton.classList.toggle("pcb-open", nextOpen);
    ui.panel.classList.toggle("pcb-open", nextOpen);
    ui.toggleButton.setAttribute("aria-expanded", String(nextOpen));

    if (nextOpen) {
      state.unread = 0;
      syncBadge(ui.badge, state.unread);
      setTimeout(() => ui.input.focus(), 30);
      scrollMessagesToBottom(ui.messages);
    }
  }

  function clearConversation() {
    state.history = [];
    state.resources = [];
    state.unread = 0;
    state.sessionId = createSessionId(config.sessionKey);
    config.sessionId = state.sessionId;
    try {
      localStorage.setItem(config.sessionKey, state.sessionId);
    } catch (_e) {}

    pushMessage(state, config, "bot", config.welcomeMessage, false);
    pushMessage(
      state,
      config,
      "bot",
      "Ask about order tracking, product search, discount offers, shipping, or store policies.",
      false,
    );
    syncBadge(ui.badge, state.unread);
    renderMessages(ui.messages, state.history, config.botInitials, config);
    renderResources(ui.resourcesList, state.resources);
  }

  // ─── Message sending ────────────────────────────────────────────────────────

  async function sendUserMessage(rawText) {
    const text = (rawText || "").trim();
    if (!text || state.busy) return;

    state.busy = true;
    ui.input.value = "";
    syncSendState(ui.input, ui.sendButton, state.busy);

    pushMessage(state, config, "user", text, false);
    renderMessages(ui.messages, state.history, config.botInitials, config);
    scrollMessagesToBottom(ui.messages);

    showTyping(ui.typing, true);

    let botReply = null;
    try {
      config.sessionId = state.sessionId;
      botReply = await fetchBotReply(config, state.history, text);
    } catch (_e) {
      botReply = null;
    }

    showTyping(ui.typing, false);

    if (!botReply || !botReply.text) {
      botReply = {
        text: "I'm having trouble right now. Please try again in a moment.",
        type: "text",
        products: [],
        resources: [],
        quickReplies: ["Track order", "Search products", "Shipping info"],
      };
    }

    const botProducts = normalizeProducts(botReply.products || []).slice(
      0,
      config.sliderLimit,
    );
    state.resources = normalizeResources(botReply.resources || []).slice(0, 6);
    renderResources(ui.resourcesList, state.resources);

    // Push the bot message with rich data
    pushMessage(state, config, "bot", botReply.text, !state.open, {
      products: botProducts,
      type: botReply.type || "text",
      data: botReply.data || null,
    });

    // Update quick replies from server response
    if (Array.isArray(botReply.quickReplies) && botReply.quickReplies.length) {
      renderQuickReplies(ui.quickReplies, botReply.quickReplies, sendUserMessage);
    }

    syncBadge(ui.badge, state.unread);
    renderMessages(ui.messages, state.history, config.botInitials, config);
    scrollMessagesToBottom(ui.messages);

    state.busy = false;
    syncSendState(ui.input, ui.sendButton, state.busy);
    ui.input.focus();
  }

  // ─── API fetch ──────────────────────────────────────────────────────────────

  async function fetchBotReply(cfg, history, message) {
    // Resolve the best endpoint: configured apiUrl → same-origin fallback
    const base = (cfg.apiUrl || "").trim().replace(/\/+$/, "");
    const endpoint = base ? `${base}/api/chat` : "/api/chat";

    const historyPayload = history
      .filter((e) => e.role === "user" || e.role === "bot")
      .slice(-10)
      .map((e) => ({ role: e.role === "user" ? "user" : "assistant", content: e.text }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: cfg.shop,
        message,
        history: historyPayload,
        sessionId: cfg.sessionId,
        visitorId: cfg.visitorId,
        sourcePage: window.location.href,
        locale: document.documentElement.lang || "en",
      }),
    });

    if (!response.ok) {
      console.error("[PCB] API error", response.status, endpoint);
      throw new Error(`API ${response.status}`);
    }
    return response.json();
  }

  // ─── Default quick replies ───────────────────────────────────────────────────

  const PCB_DEFAULT_QUICK_REPLIES = [
    "Track my order",
    "Search products",
    "Discount offers",
    "Shipping info",
    "Return policy",
  ];

  // ─── Config ─────────────────────────────────────────────────────────────────

  function buildConfig(root) {
    const d = root.dataset;
    const color = sanitizeColor(d.color || "#008060");
    const shop = (d.shop || window.location.hostname || "shop").toLowerCase();
    const quickReplies = parseQuickReplies(d.quickReplies);
    const visitorKey = `pcb-visitor:${shop}`;
    const sessionKey = `pcb-session:${shop}`;
    const visitorId = getOrCreateStorageValue(visitorKey, createVisitorId);
    const sessionId = getOrCreateStorageValue(sessionKey, createSessionId);

    return {
      botName: (d.botName || "Shop Assistant").trim(),
      subtitle: (d.subtitle || "Online now").trim(),
      botInitials: getInitials(d.botName || "Shop Assistant"),
      welcomeMessage: (d.welcome || "Hi! Ask me about products, pricing, or recommendations.").trim(),
      primaryColor: color,
      primaryColorDark: darkenColor(color, 20),
      buttonSize: clampNumber(parseInt(d.btnSize || "56", 10), 44, 72, 56),
      autoOpen: parseBoolean(d.autoOpen),
      showOnMobile: d.showMobile !== undefined ? parseBoolean(d.showMobile) : true,
      showProductSlider: d.showProductSlider !== undefined ? parseBoolean(d.showProductSlider) : true,
      showComparePrice: d.showComparePrice !== undefined ? parseBoolean(d.showComparePrice) : true,
      productClickTarget: String(d.productClickTarget || "same-tab").toLowerCase() === "new-tab" ? "_blank" : "_self",
      sliderLimit: clampNumber(parseInt(d.sliderLimit || "5", 10), 1, 10, 5),
      showPoweredBy: d.showPoweredBy !== undefined ? parseBoolean(d.showPoweredBy) : true,
      testMode: parseBoolean(d.testMode),
      shop,
      apiUrl: normalizeApiBaseUrl(d.apiUrl),
      quickReplies: quickReplies.length ? quickReplies : PCB_DEFAULT_QUICK_REPLIES,
      storageKey: `pcb-history:${shop}`,
      visitorKey,
      sessionKey,
      visitorId,
      sessionId,
    };
  }

  function applyTheme(root, config) {
    root.style.setProperty("--pcb-color", config.primaryColor);
    root.style.setProperty("--pcb-color-dark", config.primaryColorDark);
    root.style.setProperty("--pcb-btn-size", `${config.buttonSize}px`);
  }

  // ─── Base UI rendering ───────────────────────────────────────────────────────

  function renderBaseUI(config) {
    const toggleButton = createElement("button", "pcb-toggle", {
      type: "button",
      "aria-label": "Toggle chat widget",
      "aria-expanded": "false",
    });

    const chatIcon = iconNode(
      "pcb-toggle-icon pcb-toggle-icon--chat",
      "M12 3C7.03 3 3 6.58 3 11c0 2.12.94 4.05 2.47 5.49L5 21l4.1-2.23c.91.25 1.88.38 2.9.38 4.97 0 9-3.58 9-8s-4.03-8.15-9-8.15Zm-3.2 9.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z",
    );
    const closeIcon = iconNode(
      "pcb-toggle-icon pcb-toggle-icon--close",
      "M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z",
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
    headerStatus.textContent = config.testMode ? "Test mode" : config.subtitle;
    headerText.appendChild(headerName);
    headerText.appendChild(headerStatus);
    headerLeft.appendChild(avatar);
    headerLeft.appendChild(headerText);

    const headerActions = createElement("div", "");
    headerActions.style.cssText = "display:flex;gap:6px";

    const clearButton = createElement("button", "pcb-header-btn", {
      type: "button",
      "aria-label": "Clear conversation",
      title: "Clear conversation",
    });
    clearButton.appendChild(
      iconNode("", "M5 5h14v2H5V5Zm1 4h12l-1 11H7L6 9Zm4-6h4l1 1h4v2H5V4h4l1-1Z"),
    );

    const closeButton = createElement("button", "pcb-header-btn", {
      type: "button",
      "aria-label": "Close chat",
      title: "Close chat",
    });
    closeButton.appendChild(
      iconNode("", "M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"),
    );

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
    const sendButton = createElement("button", "pcb-send", {
      type: "button",
      "aria-label": "Send message",
    });
    sendButton.appendChild(iconNode("", "M2 21 23 12 2 3v7l15 2-15 2z"));
    inputRow.appendChild(input);
    inputRow.appendChild(sendButton);

    const footer = createElement("div", "pcb-footer");
    if (config.showPoweredBy) {
      footer.textContent = "Powered by Chat Boat";
    } else {
      footer.classList.add("pcb-hidden");
    }

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(typing);
    panel.appendChild(quickReplies);
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
      resources,
      resourcesList,
      input,
      sendButton,
    };
  }

  // ─── Message rendering ───────────────────────────────────────────────────────

  function renderMessages(container, history, botInitials, config) {
    container.innerHTML = "";
    history.forEach((entry) => {
      const role = entry.role === "user" ? "user" : "bot";
      const item = createElement("div", `pcb-msg-item pcb-msg-item--${role}`);
      const row = createElement("div", `pcb-msg pcb-msg--${role}`);
      const avatar = createElement("div", "pcb-msg-avatar");
      avatar.textContent = role === "user" ? "Y" : botInitials;

      const bubble = createElement("div", "pcb-bubble");
      bubble.innerHTML = renderMarkdownLight(entry.text);
      row.appendChild(avatar);
      row.appendChild(bubble);

      const meta = createElement("div", "pcb-msg-meta");
      const time = createElement("span", "pcb-msg-time");
      time.textContent = formatClock(entry.timestamp);
      meta.appendChild(time);

      item.appendChild(row);
      item.appendChild(meta);

      // Render rich cards based on message type
      if (role === "bot" && entry.type && entry.type !== "text") {
        const card = renderRichCard(entry.type, entry.data, entry.products, config);
        if (card) {
          const cardWrapper = createElement("div", "pcb-card-wrapper");
          cardWrapper.appendChild(card);
          item.appendChild(cardWrapper);
        }
      } else if (role === "bot" && Array.isArray(entry.products) && entry.products.length > 0) {
        // Legacy product slider
        const slider = renderProductSlider(entry.products, config);
        if (slider) {
          const sliderWrapper = createElement("div", "pcb-inline-products");
          sliderWrapper.appendChild(slider);
          item.appendChild(sliderWrapper);
        }
      }

      container.appendChild(item);
    });
  }

  // ─── Rich card router ────────────────────────────────────────────────────────

  function renderRichCard(type, data, products, config) {
    switch (type) {
      case "order_status":
        return data ? renderOrderStatusCard(data) : null;
      case "product_cards":
        return (data?.products?.length || products?.length)
          ? renderProductCards(data?.products || products, config)
          : null;
      case "coupon_result":
        return data ? renderCouponCard(data) : null;
      case "discount_list":
        return data?.discounts?.length ? renderDiscountList(data.discounts) : null;
      case "shipping_info":
        return data?.items?.length ? renderShippingInfoCard(data) : null;
      case "gift_products":
        return data ? renderGiftProductsCard(data, config) : null;
      case "cart_action":
        return data ? renderCartActionCard(data) : null;
      default:
        if (Array.isArray(products) && products.length) {
          return renderProductCards(products, config);
        }
        return null;
    }
  }

  // ─── Order Status Card ───────────────────────────────────────────────────────

  function renderOrderStatusCard(order) {
    const card = createElement("div", "pcb-order-card");

    // Header row
    const header = createElement("div", "pcb-order-header");
    const orderName = createElement("span", "pcb-order-name");
    orderName.textContent = order.orderName || "Order";
    const stageBadge = createElement("span", `pcb-order-stage ${order.stageClass || "pcb-stage--processing"}`);
    stageBadge.textContent = order.stage || "Processing";
    header.appendChild(orderName);
    header.appendChild(stageBadge);
    card.appendChild(header);

    // Order date
    if (order.processedAtFormatted) {
      const dateRow = createElement("div", "pcb-order-row");
      dateRow.innerHTML = `<span class="pcb-order-label">Placed on</span><span class="pcb-order-value">${escHtml(order.processedAtFormatted)}</span>`;
      card.appendChild(dateRow);
    }

    // Items
    if (order.items?.length) {
      const itemsSection = createElement("div", "pcb-order-items");
      order.items.forEach((item) => {
        const itemEl = createElement("div", "pcb-order-item-line");
        itemEl.textContent = `${item.title} × ${item.quantity}`;
        itemsSection.appendChild(itemEl);
      });
      card.appendChild(itemsSection);
    }

    // Total
    if (order.total) {
      const totalRow = createElement("div", "pcb-order-row");
      totalRow.innerHTML = `<span class="pcb-order-label">Total</span><span class="pcb-order-value pcb-order-total">${escHtml(order.currency || "INR")} ${escHtml(order.total)}</span>`;
      card.appendChild(totalRow);
    }

    // Tracking
    if (order.trackingNumber) {
      const trackRow = createElement("div", "pcb-order-tracking");
      const trackLabel = createElement("div", "pcb-order-tracking-info");
      trackLabel.innerHTML = `<span class="pcb-order-label">Tracking</span><span class="pcb-order-value">${escHtml(order.trackingNumber)}${order.trackingCompany ? ` (${escHtml(order.trackingCompany)})` : ""}</span>`;
      trackRow.appendChild(trackLabel);

      if (order.trackingUrl) {
        const trackBtn = createElement("a", "pcb-order-track-btn", {
          href: order.trackingUrl,
          target: "_blank",
          rel: "noopener noreferrer",
        });
        trackBtn.textContent = "Track Shipment →";
        trackRow.appendChild(trackBtn);
      }
      card.appendChild(trackRow);
    }

    // ETA / Delivered
    if (order.deliveredAtFormatted) {
      const etaRow = createElement("div", "pcb-order-row pcb-order-delivered");
      etaRow.innerHTML = `<span>✅ Delivered on ${escHtml(order.deliveredAtFormatted)}</span>`;
      card.appendChild(etaRow);
    } else if (order.estimatedDeliveryFormatted) {
      const etaRow = createElement("div", "pcb-order-row");
      etaRow.innerHTML = `<span class="pcb-order-label">Estimated delivery</span><span class="pcb-order-value">${escHtml(order.estimatedDeliveryFormatted)}</span>`;
      card.appendChild(etaRow);
    }

    return card;
  }

  // ─── Product Cards (grid / slider) ──────────────────────────────────────────

  function renderProductCards(products, config) {
    if (!Array.isArray(products) || !products.length) return null;

    const wrapper = createElement("div", "pcb-product-cards-wrapper");
    const label = createElement("div", "pcb-products-label");
    label.textContent = "Products";
    wrapper.appendChild(label);

    const track = createElement("div", "pcb-products-track");

    products.forEach((p) => {
      const href = normalizeProductUrl(p.url, p.title);
      const card = createElement("div", "pcb-product-card");

      // Image
      if (p.image) {
        const img = createElement("img", "pcb-product-img", {
          src: p.image,
          alt: p.imageAlt || p.title || "Product",
          loading: "lazy",
        });
        card.appendChild(img);
      } else {
        const placeholder = createElement("div", "pcb-product-img-placeholder");
        placeholder.textContent = (p.title || "?").charAt(0).toUpperCase();
        card.appendChild(placeholder);
      }

      // Info
      const info = createElement("div", "pcb-product-info");

      const title = createElement("p", "pcb-product-title");
      title.textContent = p.title || "Product";
      info.appendChild(title);

      // Stock badge
      const stockBadge = createElement("span", p.available !== false ? "pcb-stock-badge pcb-stock-in" : "pcb-stock-badge pcb-stock-out");
      stockBadge.textContent = p.available !== false ? "In Stock" : "Sold Out";
      info.appendChild(stockBadge);

      // Pricing
      const pricing = createElement("div", "pcb-product-pricing");
      const price = createElement("span", "pcb-product-price");
      price.textContent = formatMoneyAmount(p.price, p.currency);
      pricing.appendChild(price);

      if (p.comparePrice && parseFloat(p.comparePrice) > parseFloat(p.price)) {
        const compare = createElement("span", "pcb-product-compare");
        compare.textContent = formatMoneyAmount(p.comparePrice, p.currency);
        pricing.appendChild(compare);

        const savePct = Math.round(
          ((parseFloat(p.comparePrice) - parseFloat(p.price)) /
            parseFloat(p.comparePrice)) *
            100,
        );
        if (savePct > 0) {
          const saveBadge = createElement("span", "pcb-discount-badge");
          saveBadge.textContent = `-${savePct}%`;
          pricing.appendChild(saveBadge);
        }
      }
      info.appendChild(pricing);
      card.appendChild(info);

      // Action buttons
      const actions = createElement("div", "pcb-product-actions");

      const viewBtn = createElement("a", "pcb-product-btn pcb-btn-view", {
        href,
        target: config.productClickTarget || "_self",
      });
      viewBtn.textContent = "View";
      actions.appendChild(viewBtn);

      if (p.available !== false) {
        const cartBtn = createElement("button", "pcb-product-btn pcb-btn-cart", {
          type: "button",
          "data-variant-id": p.variantId || "",
          "data-product-url": href,
        });
        cartBtn.textContent = "Add to Cart";
        cartBtn.addEventListener("click", (e) => {
          e.preventDefault();
          handleAddToCart(p, cartBtn);
        });
        actions.appendChild(cartBtn);

        const buyBtn = createElement("a", "pcb-product-btn pcb-btn-buy", {
          href: p.variantId
            ? `/cart/${p.variantId.replace("gid://shopify/ProductVariant/", "")}:1?checkout`
            : `${href}`,
          target: "_self",
        });
        buyBtn.textContent = "Buy Now";
        actions.appendChild(buyBtn);
      }

      card.appendChild(actions);
      track.appendChild(card);
    });

    wrapper.appendChild(track);
    return wrapper;
  }

  async function handleAddToCart(product, btn) {
    const variantNumericId = (product.variantId || "").replace(
      "gid://shopify/ProductVariant/",
      "",
    );
    if (!variantNumericId) {
      window.location.href = product.url || "/collections/all";
      return;
    }

    const originalText = btn.textContent;
    btn.textContent = "Adding...";
    btn.disabled = true;

    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: parseInt(variantNumericId), quantity: 1 }),
      });
      if (res.ok) {
        btn.textContent = "✓ Added!";
        btn.classList.add("pcb-btn-added");
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
          btn.classList.remove("pcb-btn-added");
        }, 2000);
      } else {
        throw new Error("Cart add failed");
      }
    } catch (_e) {
      btn.textContent = "View →";
      btn.disabled = false;
      btn.addEventListener(
        "click",
        () => {
          window.location.href = product.url || "/collections/all";
        },
        { once: true },
      );
    }
  }

  // ─── Coupon Card ─────────────────────────────────────────────────────────────

  function renderCouponCard(data) {
    const card = createElement("div", `pcb-coupon-card ${data.valid ? "pcb-coupon-valid" : "pcb-coupon-invalid"}`);

    const statusRow = createElement("div", "pcb-coupon-status-row");
    const statusIcon = createElement("span", "pcb-coupon-status-icon");
    statusIcon.textContent = data.valid ? "✓" : "✗";
    const statusText = createElement("span", "pcb-coupon-status-text");
    statusText.textContent = data.valid ? "Coupon Valid" : "Invalid Coupon";
    statusRow.appendChild(statusIcon);
    statusRow.appendChild(statusText);
    card.appendChild(statusRow);

    if (data.code) {
      const codeEl = createElement("div", "pcb-coupon-code-display");
      codeEl.textContent = data.code;
      card.appendChild(codeEl);
    }

    if (data.valid) {
      const valueEl = createElement("div", "pcb-coupon-value");
      valueEl.textContent = data.valueLabel || "";
      card.appendChild(valueEl);

      if (data.minimumCartFormatted) {
        const minEl = createElement("div", "pcb-coupon-min");
        minEl.textContent = `Min. cart value: ${data.minimumCartFormatted}`;
        card.appendChild(minEl);
      }

      if (data.endsAt) {
        const expiryEl = createElement("div", "pcb-coupon-expiry");
        expiryEl.textContent = `Valid till: ${new Date(data.endsAt).toLocaleDateString("en-IN")}`;
        card.appendChild(expiryEl);
      }

      const copyBtn = createElement("button", "pcb-coupon-copy-btn", { type: "button" });
      copyBtn.textContent = "Copy Code";
      copyBtn.addEventListener("click", () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.code).catch(() => {});
        }
        copyBtn.textContent = "✓ Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy Code"), 2000);
      });
      card.appendChild(copyBtn);
    } else {
      const reasonEl = createElement("div", "pcb-coupon-reason");
      reasonEl.textContent = data.reason || "This coupon is not valid";
      card.appendChild(reasonEl);
    }

    return card;
  }

  // ─── Discount List Card ───────────────────────────────────────────────────────

  function renderDiscountList(discounts) {
    const wrapper = createElement("div", "pcb-discount-list");
    const label = createElement("div", "pcb-discount-list-label");
    label.textContent = "Active Offers";
    wrapper.appendChild(label);

    discounts.forEach((d) => {
      const item = createElement("div", "pcb-discount-item");

      const codeEl = createElement("span", "pcb-discount-code");
      codeEl.textContent = d.code;
      item.appendChild(codeEl);

      const valueEl = createElement("span", "pcb-discount-value-badge");
      valueEl.textContent = d.valueLabel;
      item.appendChild(valueEl);

      if (d.minimumCartFormatted) {
        const minEl = createElement("span", "pcb-discount-min-label");
        minEl.textContent = `Min. ${d.minimumCartFormatted}`;
        item.appendChild(minEl);
      }

      const copyBtn = createElement("button", "pcb-discount-copy-btn", { type: "button" });
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(d.code).catch(() => {});
        }
        copyBtn.textContent = "✓";
        setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
      });
      item.appendChild(copyBtn);

      wrapper.appendChild(item);
    });

    return wrapper;
  }

  // ─── Shipping Info Card ───────────────────────────────────────────────────────

  function renderShippingInfoCard(data) {
    const card = createElement("div", "pcb-shipping-card");

    if (Array.isArray(data.items)) {
      data.items.forEach((row) => {
        const itemEl = createElement("div", "pcb-shipping-row");
        const iconEl = createElement("span", "pcb-shipping-icon");
        iconEl.textContent = row.icon || "📦";
        const labelEl = createElement("span", "pcb-shipping-label");
        labelEl.textContent = row.label || "";
        const valueEl = createElement("span", "pcb-shipping-value");
        valueEl.textContent = row.value || "";
        itemEl.appendChild(iconEl);
        itemEl.appendChild(labelEl);
        itemEl.appendChild(valueEl);
        card.appendChild(itemEl);
      });
    }

    return card;
  }

  // ─── Gift Products Card ───────────────────────────────────────────────────────

  function renderGiftProductsCard(data, config) {
    const wrapper = createElement("div", "pcb-gift-card");

    if (data.threshold) {
      const banner = createElement("div", "pcb-gift-banner");
      banner.innerHTML = `🎁 <strong>Add items worth ${escHtml(data.thresholdFormatted || `₹${data.threshold}`)}</strong> to unlock a FREE gift!`;
      wrapper.appendChild(banner);
    }

    if (Array.isArray(data.products) && data.products.length) {
      const giftProductsEl = renderProductCards(data.products, config);
      if (giftProductsEl) wrapper.appendChild(giftProductsEl);
    }

    if (data.instructions) {
      const instrEl = createElement("div", "pcb-gift-instructions");
      instrEl.textContent = data.instructions;
      wrapper.appendChild(instrEl);
    }

    return wrapper;
  }

  // ─── Cart Action Card ─────────────────────────────────────────────────────────

  function renderCartActionCard(data) {
    const card = createElement("div", "pcb-cart-card");

    const msgEl = createElement("p", "pcb-cart-message");
    msgEl.textContent = data.message || "View your cart to proceed to checkout.";
    card.appendChild(msgEl);

    const btnRow = createElement("div", "pcb-cart-btn-row");

    if (data.cartUrl) {
      const cartBtn = createElement("a", "pcb-cart-btn pcb-cart-btn-secondary", {
        href: data.cartUrl,
      });
      cartBtn.textContent = "View Cart";
      btnRow.appendChild(cartBtn);
    }

    if (data.checkoutUrl) {
      const checkoutBtn = createElement("a", "pcb-cart-btn pcb-cart-btn-primary", {
        href: data.checkoutUrl,
      });
      checkoutBtn.textContent = "Checkout →";
      btnRow.appendChild(checkoutBtn);
    }

    card.appendChild(btnRow);
    return card;
  }

  // ─── Legacy product slider (for old history entries) ────────────────────────

  function renderProductSlider(products, config) {
    if (!products || !products.length) return null;
    const track = createElement("div", "pcb-inline-products-track");
    products.forEach((p) => {
      const href = normalizeProductUrl(p.url, p.title);
      const card = createElement("a", "pcb-product-card", {
        href,
        target: config.productClickTarget || "_self",
      });

      if (p.image) {
        const img = createElement("img", "pcb-product-img", {
          src: p.image,
          alt: p.title || "Product",
          loading: "lazy",
        });
        card.appendChild(img);
      } else {
        const ph = createElement("div", "pcb-product-img-placeholder");
        ph.textContent = (p.title || "?").charAt(0).toUpperCase();
        card.appendChild(ph);
      }

      const info = createElement("div", "pcb-product-info");
      const title = createElement("p", "pcb-product-title");
      title.textContent = p.title || "Product";
      info.appendChild(title);

      if (p.price) {
        const pricing = createElement("div", "pcb-product-pricing");
        const price = createElement("span", "pcb-product-price");
        price.textContent = p.price;
        pricing.appendChild(price);
        if (p.comparePrice) {
          const compare = createElement("span", "pcb-product-compare");
          compare.textContent = p.comparePrice;
          pricing.appendChild(compare);
        }
        info.appendChild(pricing);
      }

      card.appendChild(info);

      const viewBtn = createElement("div", "pcb-product-btn");
      viewBtn.textContent = "View →";
      card.appendChild(viewBtn);

      track.appendChild(card);
    });

    return track;
  }

  // ─── Quick replies ────────────────────────────────────────────────────────────

  function renderQuickReplies(container, replies, onSend) {
    container.innerHTML = "";
    const safeReplies = Array.isArray(replies) ? replies.slice(0, 8) : [];
    safeReplies.forEach((text) => {
      const chip = createElement("button", "pcb-chip", { type: "button" });
      chip.textContent = String(text || "").trim();
      chip.addEventListener("click", () => {
        void onSend(chip.textContent);
      });
      container.appendChild(chip);
    });
  }

  function renderResources(container, resources) {
    const section = container.closest(".pcb-resources");
    if (!resources.length) {
      if (section) section.classList.add("pcb-hidden");
      return;
    }
    if (section) section.classList.remove("pcb-hidden");
    container.innerHTML = "";
    resources.forEach((r) => {
      const card = createElement("a", "pcb-resource-card", {
        href: r.url,
        target: "_blank",
        rel: "noopener noreferrer",
      });
      const top = createElement("div", "pcb-resource-top");
      const title = createElement("span", "pcb-resource-title");
      title.textContent = r.title;
      const type = createElement("span", "pcb-resource-type");
      type.textContent = r.type;
      top.appendChild(title);
      top.appendChild(type);
      const desc = createElement("p", "pcb-resource-desc");
      desc.textContent = r.description;
      card.appendChild(top);
      card.appendChild(desc);
      container.appendChild(card);
    });
  }

  // ─── Utility functions ────────────────────────────────────────────────────────

  function renderMarkdownLight(text) {
    return escHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeProducts(rawProducts) {
    if (!Array.isArray(rawProducts)) return [];
    return rawProducts
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        if (!title) return null;
        const url = normalizeProductUrl(
          item.url || item.handle ? `/products/${item.handle}` : "",
          title,
        );
        return {
          id: item.id || null,
          title,
          handle: item.handle || null,
          url,
          image: item.image || item.imageUrl || item.img || "",
          imageAlt: item.imageAlt || title,
          price: item.price || "",
          comparePrice: item.comparePrice || item.compare_at_price || "",
          currency: item.currency || "INR",
          available: item.available !== false,
          variantId: item.variantId || null,
          tags: item.tags || [],
        };
      })
      .filter(Boolean);
  }

  function normalizeResources(rawResources) {
    if (!Array.isArray(rawResources)) return [];
    return rawResources
      .map((item) => ({
        title: String(item.title || item.name || "Store link"),
        url: String(item.url || item.link || "#"),
        type: String(item.type || "Info"),
        description: String(item.description || "Open details"),
      }))
      .filter((r) => r.title && r.url);
  }

  function pushMessage(state, config, role, text, countUnread, options = {}) {
    const normalizedProducts = Array.isArray(options.products)
      ? normalizeProducts(options.products).slice(0, Math.max(1, Number(config?.sliderLimit) || 5))
      : [];
    const entry = {
      role: role === "user" ? "user" : "bot",
      text: String(text || "").trim(),
      timestamp: Date.now(),
      products: normalizedProducts,
      type: options.type || "text",
      data: options.data || null,
    };
    if (!entry.text) return;

    state.history.push(entry);
    state.history = state.history.slice(-40);
    saveHistory(config.storageKey, state.history);

    if (countUnread && entry.role === "bot") state.unread += 1;
  }

  function loadHistory(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (e) =>
            e &&
            (e.role === "user" || e.role === "bot") &&
            typeof e.text === "string",
        )
        .map((e) => ({
          role: e.role,
          text: e.text,
          timestamp: Number(e.timestamp) || Date.now(),
          products: Array.isArray(e.products) ? normalizeProducts(e.products).slice(0, 10) : [],
          type: e.type || "text",
          data: e.data || null,
        }))
        .slice(-40);
    } catch (_e) {
      return [];
    }
  }

  function saveHistory(storageKey, history) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (_e) {}
  }

  function syncBadge(badge, count) {
    if (!badge) return;
    badge.textContent = String(count);
    badge.classList.toggle("pcb-hidden", count <= 0);
  }

  function showTyping(typingNode, show) {
    if (!typingNode) return;
    typingNode.classList.toggle("pcb-hidden", !show);
  }

  function syncSendState(input, button, busy) {
    button.disabled = !input.value.trim() || busy;
  }

  function scrollMessagesToBottom(messages) {
    messages.scrollTop = messages.scrollHeight;
  }

  function parseQuickReplies(value) {
    if (!value || typeof value !== "string") return [];
    return value
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    const n = String(value || "").toLowerCase();
    return n === "true" || n === "1" || n === "yes" || n === "on";
  }

  function normalizeApiBaseUrl(url) {
    if (!url || typeof url !== "string") return "";
    return url.trim().replace(/\/+$/, "");
  }

  function getOrCreateStorageValue(key, generator) {
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const value = generator(key);
      localStorage.setItem(key, value);
      return value;
    } catch (_e) {
      return generator(key);
    }
  }

  function createVisitorId(seed) {
    const random = Math.random().toString(36).slice(2, 10);
    const source = `${seed || "visitor"}:${Date.now()}:${random}`;
    return `v_${simpleHash(source)}`;
  }

  function createSessionId(seed) {
    const random = Math.random().toString(36).slice(2, 8);
    return `s_${simpleHash(`${seed || "session"}:${Date.now()}:${random}`)}`;
  }

  function simpleHash(input) {
    const text = String(input || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function createElement(tagName, className, attrs) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function iconNode(className, pathD) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    if (className) svg.setAttribute("class", className);
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }

  function sanitizeColor(value) {
    const color = String(value || "").trim();
    return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(color) ? color : "#008060";
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
    const raw =
      normalized.length === 3
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
    const toHex = (v) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }


  function formatMoneyAmount(amount, currencyCode) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return "";
    const currency = String(currencyCode || "INR").toUpperCase();
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch (_e) {
      return `₹${value.toFixed(0)}`;
    }
  }

  function normalizeProductUrl(rawUrl, title) {
    const value = String(rawUrl || "").trim();
    if (value) {
      if (/^https?:\/\//i.test(value)) return value;
      if (value.startsWith("/")) return value;
      if (value.startsWith("products/") || value.startsWith("collections/")) return `/${value}`;
      return `/products/${value.replace(/^\/+/, "")}`;
    }
    const fallback = String(title || "").trim();
    return fallback ? `/search?q=${encodeURIComponent(fallback)}` : "/collections/all";
  }

  function getInitials(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return "AI";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  function clampNumber(value, min, max, fallback) {
    if (Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function formatClock(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_e) {
      return "";
    }
  }
})();
