import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Divider,
  Badge,
  Banner,
  Box,
  RangeSlider,
  ChoiceList,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  // TODO: save to BotConfig model in DB
  return { success: true, savedAt: new Date().toISOString() };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  { hex: "#008060", label: "Shopify Green" },
  { hex: "#005bd3", label: "Blue" },
  { hex: "#bf0711", label: "Red" },
  { hex: "#e6a817", label: "Gold" },
  { hex: "#6d1ea1", label: "Purple" },
  { hex: "#1a1a1a", label: "Black" },
];

const AI_PROVIDERS = [
  { label: "Claude Haiku (Anthropic) — Recommended", value: "claude" },
  { label: "OpenAI (GPT-4o)", value: "openai" },
];

const POSITION_OPTIONS = [
  { label: "Bottom Right", value: "bottom-right" },
  { label: "Bottom Left", value: "bottom-left" },
];

const DEFAULTS = {
  botName: "Shop Assistant",
  welcomeMessage: "Hi! I'm here to help you find the perfect product. What are you looking for today?",
  offlineMessage: "Thanks for reaching out! Our bot will respond shortly.",
  primaryColor: "#008060",
  position: ["bottom-right"],
  aiProvider: "claude",
  apiKey: "",
  maxProducts: 5,
  temperature: 0.7,
  isEnabled: false,
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <BlockStack gap="100">
      <Text as="h2" variant="headingMd">{title}</Text>
      {subtitle && <Text as="p" variant="bodySm" tone="subdued">{subtitle}</Text>}
    </BlockStack>
  );
}

function ColorSwatch({ hex, label, selected, onSelect }) {
  return (
    <Tooltip content={label}>
      <Box
        as="button"
        onClick={() => onSelect(hex)}
        width="32px"
        minHeight="32px"
        borderRadius="full"
        borderWidth={selected ? "050" : "025"}
        borderColor={selected ? "border-focus" : "border"}
        style={{
          background: hex,
          cursor: "pointer",
          outline: selected ? `3px solid ${hex}55` : "none",
          outlineOffset: "2px",
          transition: "outline 0.15s ease",
        }}
        aria-label={label}
        aria-pressed={selected}
      />
    </Tooltip>
  );
}

// ─── Live Widget Preview ───────────────────────────────────────────────────────
function WidgetPreview({ botName, welcomeMessage, primaryColor, position }) {
  const short = welcomeMessage.length > 65
    ? welcomeMessage.slice(0, 65) + "…"
    : welcomeMessage;

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodySm" tone="subdued">
        Live preview · updates as you type
      </Text>
      <Box
        borderRadius="300"
        borderWidth="025"
        borderColor="border"
        background="bg-surface"
        overflow="hidden"
      >
        {/* Header */}
        <Box padding="300" style={{ background: primaryColor }}>
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Box
                width="28px"
                minHeight="28px"
                background="bg-surface"
                borderRadius="full"
                style={{ opacity: 0.3 }}
              />
              <Text as="p" variant="bodyMd" fontWeight="semibold" tone="text-inverse">
                {botName || "Shop Assistant"}
              </Text>
            </InlineStack>
            <Text as="span" tone="text-inverse" variant="bodySm">✕</Text>
          </InlineStack>
        </Box>

        {/* Messages area */}
        <Box padding="300" background="bg-surface-secondary" minHeight="130px">
          <BlockStack gap="200">
            {/* Bot bubble */}
            <InlineStack align="start" gap="150">
              <Box
                width="24px"
                minHeight="24px"
                borderRadius="full"
                style={{ background: primaryColor, flexShrink: 0 }}
              />
              <Box
                padding="200"
                background="bg-surface"
                borderRadius="200"
                maxWidth="80%"
              >
                <Text as="p" variant="bodySm">{short}</Text>
              </Box>
            </InlineStack>

            {/* User bubble */}
            <InlineStack align="end">
              <Box
                padding="200"
                borderRadius="200"
                maxWidth="70%"
                style={{ background: primaryColor }}
              >
                <Text as="p" variant="bodySm" tone="text-inverse">
                  Show me running shoes
                </Text>
              </Box>
            </InlineStack>

            {/* Bot reply */}
            <InlineStack align="start" gap="150">
              <Box
                width="24px"
                minHeight="24px"
                borderRadius="full"
                style={{ background: primaryColor, flexShrink: 0 }}
              />
              <Box
                padding="200"
                background="bg-surface"
                borderRadius="200"
                maxWidth="80%"
              >
                <Text as="p" variant="bodySm">Here are 5 running shoes I found…</Text>
              </Box>
            </InlineStack>
          </BlockStack>
        </Box>

        {/* Input */}
        <Box
          padding="200"
          borderBlockStartWidth="025"
          borderColor="border"
          background="bg-surface"
        >
          <InlineStack gap="150" blockAlign="center">
            <Box
              borderRadius="200"
              borderWidth="025"
              borderColor="border"
              padding="150"
              minWidth="0"
              width="100%"
            >
              <Text as="p" variant="bodySm" tone="subdued">Type a message…</Text>
            </Box>
            <Box
              padding="150"
              borderRadius="200"
              style={{ background: primaryColor, flexShrink: 0 }}
            >
              <Text as="span" tone="text-inverse" variant="bodySm">→</Text>
            </Box>
          </InlineStack>
        </Box>
      </Box>

      {/* Position indicator */}
      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
        Widget shown at {position[0] === "bottom-right" ? "bottom right" : "bottom left"}
      </Text>
    </BlockStack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // ── Form state ────────────────────────────────────────
  const [botName, setBotName] = useState(DEFAULTS.botName);
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULTS.welcomeMessage);
  const [offlineMessage, setOfflineMessage] = useState(DEFAULTS.offlineMessage);
  const [primaryColor, setPrimaryColor] = useState(DEFAULTS.primaryColor);
  const [position, setPosition] = useState(DEFAULTS.position);
  const [aiProvider, setAiProvider] = useState(DEFAULTS.aiProvider);
  const [apiKey, setApiKey] = useState(DEFAULTS.apiKey);
  const [maxProducts, setMaxProducts] = useState(DEFAULTS.maxProducts);
  const [temperature, setTemperature] = useState(DEFAULTS.temperature);
  const [isEnabled, setIsEnabled] = useState(DEFAULTS.isEnabled);

  const isSaving = ["loading", "submitting"].includes(fetcher.state);

  // ── Show toast when save completes ────────────────────
  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Settings saved successfully");
    }
  }, [fetcher.data, shopify]);

  // ── Unsaved changes detection ──────────────────────────
  const hasChanges = useMemo(
    () =>
      botName !== DEFAULTS.botName ||
      welcomeMessage !== DEFAULTS.welcomeMessage ||
      offlineMessage !== DEFAULTS.offlineMessage ||
      primaryColor !== DEFAULTS.primaryColor ||
      position[0] !== DEFAULTS.position[0] ||
      aiProvider !== DEFAULTS.aiProvider ||
      apiKey !== DEFAULTS.apiKey ||
      maxProducts !== DEFAULTS.maxProducts ||
      temperature !== DEFAULTS.temperature ||
      isEnabled !== DEFAULTS.isEnabled,
    [botName, welcomeMessage, offlineMessage, primaryColor, position, aiProvider, apiKey, maxProducts, temperature, isEnabled],
  );

  // ── API key validation ─────────────────────────────────
  const apiKeyError = useMemo(() => {
    if (!apiKey) return null;
    if (aiProvider === "claude" && !apiKey.startsWith("sk-ant-")) {
      return "Claude API keys start with sk-ant-";
    }
    if (aiProvider === "openai" && !apiKey.startsWith("sk-")) {
      return "OpenAI API keys start with sk-";
    }
    return null;
  }, [apiKey, aiProvider]);

  // ── Handlers ──────────────────────────────────────────
  const handleSave = useCallback(() => {
    const form = new FormData();
    form.append("botName", botName);
    form.append("welcomeMessage", welcomeMessage);
    form.append("offlineMessage", offlineMessage);
    form.append("primaryColor", primaryColor);
    form.append("position", position[0]);
    form.append("aiProvider", aiProvider);
    form.append("apiKey", apiKey);
    form.append("maxProducts", String(maxProducts));
    form.append("temperature", String(temperature));
    form.append("isEnabled", String(isEnabled));
    fetcher.submit(form, { method: "POST" });
  }, [botName, welcomeMessage, offlineMessage, primaryColor, position, aiProvider, apiKey, maxProducts, temperature, isEnabled, fetcher]);

  const handleReset = useCallback(() => {
    setBotName(DEFAULTS.botName);
    setWelcomeMessage(DEFAULTS.welcomeMessage);
    setOfflineMessage(DEFAULTS.offlineMessage);
    setPrimaryColor(DEFAULTS.primaryColor);
    setPosition(DEFAULTS.position);
    setAiProvider(DEFAULTS.aiProvider);
    setApiKey(DEFAULTS.apiKey);
    setMaxProducts(DEFAULTS.maxProducts);
    setTemperature(DEFAULTS.temperature);
    setIsEnabled(DEFAULTS.isEnabled);
    shopify.toast.show("Settings reset to defaults");
  }, [shopify]);

  const handleToggle = useCallback(() => {
    const next = !isEnabled;
    setIsEnabled(next);
    shopify.toast.show(next ? "ChatBot activated" : "ChatBot deactivated");
  }, [isEnabled, shopify]);

  return (
    <Page>
      <TitleBar title="ChatBot Settings">
        <button onClick={handleSave} loading={isSaving} disabled={!hasChanges}>
          Save Settings
        </button>
        <button variant="primary" onClick={handleToggle}>
          {isEnabled ? "Deactivate Bot" : "Activate Bot"}
        </button>
      </TitleBar>

      <BlockStack gap="600">
        {/* ── Status Banner ─────────────────────────────── */}
        <Banner
          tone={isEnabled ? "success" : "warning"}
          title={isEnabled ? "ChatBot is active on your storefront" : "ChatBot is currently inactive"}
        >
          <Text as="p" variant="bodyMd">
            {isEnabled
              ? "Customers can chat with your bot. Monitor activity in Chat Logs."
              : "Click Activate Bot to enable the chat widget on your storefront."}
          </Text>
        </Banner>

        {/* ── Unsaved changes warning ─────────────────── */}
        {hasChanges && (
          <Banner tone="info" title="You have unsaved changes">
            <InlineStack gap="200">
              <Button onClick={handleSave} loading={isSaving}>Save now</Button>
              <Button variant="plain" onClick={handleReset}>Reset to defaults</Button>
            </InlineStack>
          </Banner>
        )}

        <Layout>
          {/* ── Left Column ───────────────────────────── */}
          <Layout.Section>
            <BlockStack gap="500">
              {/* General */}
              <Card>
                <BlockStack gap="400">
                  <SectionHeader
                    title="General Settings"
                    subtitle="Customize your chatbot's name and messages."
                  />
                  <Divider />
                  <TextField
                    label="Bot Name"
                    value={botName}
                    onChange={setBotName}
                    helpText="Shown in the chat widget header."
                    maxLength={40}
                    showCharacterCount
                    autoComplete="off"
                  />
                  <TextField
                    label="Welcome Message"
                    value={welcomeMessage}
                    onChange={setWelcomeMessage}
                    multiline={3}
                    helpText="Shown when a customer first opens the chat."
                    maxLength={160}
                    showCharacterCount
                    autoComplete="off"
                  />
                  <TextField
                    label="Fallback / Offline Message"
                    value={offlineMessage}
                    onChange={setOfflineMessage}
                    multiline={2}
                    helpText="Shown when the AI cannot answer a question."
                    maxLength={120}
                    showCharacterCount
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>

              {/* Appearance */}
              <Card>
                <BlockStack gap="400">
                  <SectionHeader
                    title="Appearance"
                    subtitle="Match the chat widget to your brand."
                  />
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">Primary Color</Text>
                    <InlineStack gap="200" wrap={false}>
                      {PRESET_COLORS.map(({ hex, label }) => (
                        <ColorSwatch
                          key={hex}
                          hex={hex}
                          label={label}
                          selected={primaryColor === hex}
                          onSelect={setPrimaryColor}
                        />
                      ))}
                    </InlineStack>
                    <TextField
                      label="Custom hex color"
                      labelHidden
                      value={primaryColor}
                      onChange={setPrimaryColor}
                      prefix="#"
                      placeholder="008060"
                      maxLength={7}
                      autoComplete="off"
                      connectedRight={
                        <Box
                          width="36px"
                          minHeight="36px"
                          borderRadius="100"
                          style={{ background: primaryColor }}
                        />
                      }
                    />
                  </BlockStack>
                  <ChoiceList
                    title="Widget Position"
                    choices={POSITION_OPTIONS}
                    selected={position}
                    onChange={setPosition}
                  />
                </BlockStack>
              </Card>

              {/* AI Config */}
              <Card>
                <BlockStack gap="400">
                  <SectionHeader
                    title="AI Configuration"
                    subtitle="Connect your AI provider to power responses."
                  />
                  <Divider />
                  <Select
                    label="AI Provider"
                    options={AI_PROVIDERS}
                    value={aiProvider}
                    onChange={(v) => { setAiProvider(v); setApiKey(""); }}
                    helpText="Claude Haiku is fast and cost-effective for product Q&A."
                  />
                  <TextField
                    label="API Key"
                    value={apiKey}
                    onChange={setApiKey}
                    type="password"
                    error={apiKeyError}
                    helpText={
                      aiProvider === "claude"
                        ? "Get your key from console.anthropic.com"
                        : "Get your key from platform.openai.com"
                    }
                    placeholder={aiProvider === "claude" ? "sk-ant-…" : "sk-…"}
                    autoComplete="off"
                    connectedRight={
                      apiKey && !apiKeyError ? (
                        <Badge tone="success">Valid format</Badge>
                      ) : null
                    }
                  />
                  <BlockStack gap="150">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">Max Products to Recommend</Text>
                      <Badge>{maxProducts}</Badge>
                    </InlineStack>
                    <RangeSlider
                      min={1} max={10} value={maxProducts} onChange={setMaxProducts} output
                    />
                    <Text as="p" variant="bodySm" tone="subdued">
                      Products suggested per message (3–5 recommended).
                    </Text>
                  </BlockStack>
                  <BlockStack gap="150">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">Response Creativity</Text>
                      <Badge>
                        {temperature <= 0.3 ? "Precise" : temperature <= 0.6 ? "Balanced" : "Creative"}
                        {" · "}{temperature}
                      </Badge>
                    </InlineStack>
                    <RangeSlider
                      min={0} max={1} step={0.1} value={temperature} onChange={setTemperature} output
                    />
                    <Text as="p" variant="bodySm" tone="subdued">
                      Lower = focused product answers. Higher = conversational.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* ── Right Column ──────────────────────────── */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Bot Status Card */}
              <Card>
                <BlockStack gap="400">
                  <SectionHeader title="Bot Status" />
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">Status</Text>
                    <Badge tone={isEnabled ? "success" : "attention"}>
                      {isEnabled ? "Active" : "Inactive"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">AI Provider</Text>
                    <Badge>{aiProvider === "claude" ? "Claude" : "OpenAI"}</Badge>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">API Key</Text>
                    <Badge tone={apiKey && !apiKeyError ? "success" : "attention"}>
                      {apiKey && !apiKeyError ? "Configured" : "Not set"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">Max products</Text>
                    <Badge>{maxProducts}</Badge>
                  </InlineStack>
                  <Divider />
                  <Button
                    fullWidth
                    tone={isEnabled ? "critical" : undefined}
                    variant={isEnabled ? "secondary" : "primary"}
                    onClick={handleToggle}
                  >
                    {isEnabled ? "Deactivate ChatBot" : "Activate ChatBot"}
                  </Button>
                </BlockStack>
              </Card>

              {/* Live Preview — fully reactive to form state */}
              <Card>
                <BlockStack gap="400">
                  <SectionHeader
                    title="Widget Preview"
                    subtitle="Updates as you edit."
                  />
                  <Divider />
                  <WidgetPreview
                    botName={botName}
                    welcomeMessage={welcomeMessage}
                    primaryColor={primaryColor}
                    position={position}
                  />
                </BlockStack>
              </Card>

              {/* Tips */}
              <Card>
                <BlockStack gap="300">
                  <SectionHeader title="Tips" />
                  <Divider />
                  <BlockStack gap="200">
                    {[
                      "Use a color that matches your store brand.",
                      "Keep the welcome message short and inviting (under 100 chars).",
                      "Claude Haiku is the fastest option for real-time chat.",
                      "Set Max Products to 3–5 for the best customer experience.",
                      "Temperature 0.4–0.6 gives balanced, helpful answers.",
                    ].map((tip) => (
                      <InlineStack key={tip} gap="150" blockAlign="start" wrap={false}>
                        <Text as="span" variant="bodySm" tone="success">•</Text>
                        <Text as="p" variant="bodySm" tone="subdued">{tip}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* ── Footer Save Row ────────────────────────────── */}
        <InlineStack align="end" gap="300">
          <Button onClick={handleReset} disabled={!hasChanges}>
            Reset to Defaults
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges || !!apiKeyError}
          >
            Save Settings
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
