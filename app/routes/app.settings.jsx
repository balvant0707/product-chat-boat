import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  Divider,
  InlineStack,
  Layout,
  Page,
  RangeSlider,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getOrCreateSettings, saveSettings } from "../models/chatbot.server";

const PRESET_COLORS = ["#008060", "#005bd3", "#bf0711", "#e6a817", "#111827"];

const POSITION_OPTIONS = [
  { label: "Bottom Right", value: "bottom-right" },
  { label: "Bottom Left", value: "bottom-left" },
];

const AI_PROVIDER_OPTIONS = [
  { label: "Claude (Recommended)", value: "claude" },
  { label: "OpenAI", value: "openai" },
];

function normalizeIncomingSettings(raw) {
  const settings = raw || {};
  return {
    botName: String(settings.botName || "Shop Assistant"),
    subtitle: String(settings.subtitle || "Online now"),
    welcomeMessage: String(
      settings.welcomeMessage ||
        "Hi! I am here to help you with products, shipping, order tracking, and returns.",
    ),
    offlineMessage: String(
      settings.offlineMessage ||
        "Thanks for reaching out. Our support team will reply as soon as possible.",
    ),
    primaryColor: String(settings.primaryColor || "#008060"),
    position: String(settings.position || "bottom-right"),
    aiProvider: String(settings.aiProvider || "claude"),
    apiKey: "",
    maxProducts: Number(settings.maxProducts || 5),
    temperature: Number(settings.temperature || 0.7),
    aiConfidenceThreshold: Number(settings.aiConfidenceThreshold || 0.6),
    isEnabled: Boolean(settings.isEnabled),
    testModeEnabled: Boolean(settings.testModeEnabled),
    showPoweredBy: Boolean(settings.showPoweredBy),
    aiEnabled: Boolean(settings.aiEnabled ?? true),
    hasApiKey: Boolean(settings.hasApiKey),
  };
}

function mapForPersistence(form) {
  return {
    botName: form.botName,
    subtitle: form.subtitle,
    welcomeMessage: form.welcomeMessage,
    offlineMessage: form.offlineMessage,
    primaryColor: form.primaryColor,
    position: form.position,
    aiProvider: form.aiProvider,
    apiKey: form.apiKey,
    maxProducts: form.maxProducts,
    temperature: form.temperature,
    aiConfidenceThreshold: form.aiConfidenceThreshold,
    isEnabled: form.isEnabled,
    testModeEnabled: form.testModeEnabled,
    showPoweredBy: form.showPoweredBy,
    aiEnabled: form.aiEnabled,
  };
}

function WidgetPreview({ form }) {
  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodySm" tone="subdued">
        Storefront preview
      </Text>
      <Box borderWidth="025" borderColor="border" borderRadius="300" overflow="hidden">
        <Box
          padding="300"
          style={{
            background: `linear-gradient(135deg, ${form.primaryColor}, ${form.primaryColor}CC)`,
          }}
        >
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text as="p" variant="headingSm" tone="text-inverse">
                {form.botName}
              </Text>
              <Text as="p" variant="bodySm" tone="text-inverse">
                {form.subtitle}
              </Text>
            </BlockStack>
            <Badge tone={form.isEnabled ? "success" : "attention"}>
              {form.isEnabled ? "Active" : "Inactive"}
            </Badge>
          </InlineStack>
        </Box>
        <Box padding="300" background="bg-surface-secondary">
          <BlockStack gap="200">
            <Box background="bg-surface" borderRadius="200" padding="200" maxWidth="80%">
              <Text as="p" variant="bodySm">
                {form.welcomeMessage}
              </Text>
            </Box>
            <InlineStack align="end">
              <Box
                borderRadius="200"
                padding="200"
                maxWidth="75%"
                style={{ background: form.primaryColor }}
              >
                <Text as="p" variant="bodySm" tone="text-inverse">
                  Track my order
                </Text>
              </Box>
            </InlineStack>
          </BlockStack>
        </Box>
      </Box>
    </BlockStack>
  );
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateSettings(session.shop);
  return {
    settings,
    themeEditorUrl: `https://${session.shop}/admin/themes/current/editor?context=apps`,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const payload = Object.fromEntries(formData.entries());
  const settings = await saveSettings(session.shop, payload);

  return {
    success: true,
    savedAt: new Date().toISOString(),
    settings,
  };
};

export default function Settings() {
  const shopify = useAppBridge();
  const fetcher = useFetcher();
  const { settings, themeEditorUrl } = useLoaderData();

  const initial = useMemo(() => normalizeIncomingSettings(settings), [settings]);
  const [savedForm, setSavedForm] = useState(initial);
  const [form, setForm] = useState(initial);

  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    setSavedForm(initial);
    setForm(initial);
  }, [initial]);

  useEffect(() => {
    if (!fetcher.data?.success) return;
    const next = normalizeIncomingSettings(fetcher.data.settings);
    setSavedForm(next);
    setForm(next);
    shopify.toast.show("Settings saved");
  }, [fetcher.data, shopify]);

  const hasChanges = useMemo(() => {
    const left = mapForPersistence(form);
    const right = mapForPersistence(savedForm);
    return JSON.stringify(left) !== JSON.stringify(right);
  }, [form, savedForm]);

  const apiKeyError = useMemo(() => {
    if (!form.apiKey) return null;
    if (form.aiProvider === "claude" && !form.apiKey.startsWith("sk-ant-")) {
      return "Claude keys must start with sk-ant-";
    }
    if (form.aiProvider === "openai" && !form.apiKey.startsWith("sk-")) {
      return "OpenAI keys must start with sk-";
    }
    return null;
  }, [form.aiProvider, form.apiKey]);

  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (apiKeyError) return;
    const payload = mapForPersistence(form);
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    fetcher.submit(formData, { method: "POST" });
  }, [apiKeyError, fetcher, form]);

  const handleReset = useCallback(() => {
    setForm(savedForm);
  }, [savedForm]);

  return (
    <Page>
      <TitleBar title="ChatBot Settings">
        <button onClick={handleSave} disabled={!hasChanges || !!apiKeyError || isSaving}>
          Save
        </button>
        <button
          onClick={() => updateField("isEnabled", !form.isEnabled)}
          variant={form.isEnabled ? undefined : "primary"}
        >
          {form.isEnabled ? "Disable Bot" : "Enable Bot"}
        </button>
      </TitleBar>

      <BlockStack gap="500">
        <Banner
          tone={form.isEnabled ? "success" : "warning"}
          title={
            form.isEnabled ? "Storefront widget is enabled" : "Storefront widget is disabled"
          }
        >
          <Text as="p" variant="bodyMd">
            Use test mode to preview behavior before publishing changes.
          </Text>
        </Banner>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Setup and Installation
              </Text>
              <Button url={themeEditorUrl}>Open Theme App Embed</Button>
            </InlineStack>
            <Divider />
            <InlineStack gap="400">
              <Checkbox
                label="Enable test mode"
                checked={form.testModeEnabled}
                onChange={(value) => updateField("testModeEnabled", value)}
              />
              <Checkbox
                label="Show Powered by"
                checked={form.showPoweredBy}
                onChange={(value) => updateField("showPoweredBy", value)}
              />
              <Checkbox
                label="Enable AI mode"
                checked={form.aiEnabled}
                onChange={(value) => updateField("aiEnabled", value)}
              />
            </InlineStack>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Branding and Widget UI
                  </Text>
                  <Divider />
                  <TextField
                    label="Bot Name"
                    value={form.botName}
                    onChange={(value) => updateField("botName", value)}
                    autoComplete="off"
                    maxLength={80}
                    showCharacterCount
                  />
                  <TextField
                    label="Subtitle"
                    value={form.subtitle}
                    onChange={(value) => updateField("subtitle", value)}
                    autoComplete="off"
                    maxLength={160}
                    showCharacterCount
                  />
                  <TextField
                    label="Welcome Message"
                    value={form.welcomeMessage}
                    onChange={(value) => updateField("welcomeMessage", value)}
                    multiline={3}
                    autoComplete="off"
                    maxLength={500}
                    showCharacterCount
                  />
                  <TextField
                    label="Offline Message"
                    value={form.offlineMessage}
                    onChange={(value) => updateField("offlineMessage", value)}
                    multiline={2}
                    autoComplete="off"
                    maxLength={500}
                    showCharacterCount
                  />
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">
                      Primary Color
                    </Text>
                    <InlineStack gap="200">
                      {PRESET_COLORS.map((hex) => (
                        <Box
                          as="button"
                          key={hex}
                          onClick={() => updateField("primaryColor", hex)}
                          width="28px"
                          minHeight="28px"
                          borderRadius="full"
                          borderWidth={form.primaryColor === hex ? "050" : "025"}
                          borderColor={
                            form.primaryColor === hex ? "border-focus" : "border-secondary"
                          }
                          style={{ background: hex, cursor: "pointer" }}
                          aria-label={hex}
                        />
                      ))}
                    </InlineStack>
                    <TextField
                      label="Custom color"
                      value={form.primaryColor}
                      onChange={(value) => updateField("primaryColor", value)}
                      autoComplete="off"
                    />
                  </BlockStack>
                  <ChoiceList
                    title="Widget Position"
                    choices={POSITION_OPTIONS}
                    selected={[form.position]}
                    onChange={(selected) =>
                      updateField("position", selected[0] || "bottom-right")
                    }
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    AI and Knowledge Controls
                  </Text>
                  <Divider />
                  <Select
                    label="AI Provider"
                    options={AI_PROVIDER_OPTIONS}
                    value={form.aiProvider}
                    onChange={(value) => updateField("aiProvider", value)}
                  />
                  <TextField
                    label="API Key"
                    value={form.apiKey}
                    onChange={(value) => updateField("apiKey", value)}
                    type="password"
                    autoComplete="off"
                    error={apiKeyError}
                    helpText={
                      form.hasApiKey && !form.apiKey
                        ? "A key is already saved. Enter a new one only if you want to replace it."
                        : "Stored per shop in database."
                    }
                  />
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm">
                        Max Products in Suggestions
                      </Text>
                      <Badge>{form.maxProducts}</Badge>
                    </InlineStack>
                    <RangeSlider
                      min={1}
                      max={10}
                      value={form.maxProducts}
                      onChange={(value) => updateField("maxProducts", value)}
                    />
                  </BlockStack>
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm">
                        AI Temperature
                      </Text>
                      <Badge>{form.temperature.toFixed(1)}</Badge>
                    </InlineStack>
                    <RangeSlider
                      min={0}
                      max={1}
                      step={0.1}
                      value={form.temperature}
                      onChange={(value) => updateField("temperature", value)}
                    />
                  </BlockStack>
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm">
                        AI Confidence Threshold
                      </Text>
                      <Badge>{form.aiConfidenceThreshold.toFixed(1)}</Badge>
                    </InlineStack>
                    <RangeSlider
                      min={0}
                      max={1}
                      step={0.1}
                      value={form.aiConfidenceThreshold}
                      onChange={(value) => updateField("aiConfidenceThreshold", value)}
                    />
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Status
                  </Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm">
                      Bot
                    </Text>
                    <Badge tone={form.isEnabled ? "success" : "attention"}>
                      {form.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm">
                      Test Mode
                    </Text>
                    <Badge tone={form.testModeEnabled ? "success" : "info"}>
                      {form.testModeEnabled ? "On" : "Off"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm">
                      AI
                    </Text>
                    <Badge tone={form.aiEnabled ? "success" : "attention"}>
                      {form.aiEnabled ? "On" : "Off"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm">
                      API Key
                    </Text>
                    <Badge tone={form.hasApiKey || form.apiKey ? "success" : "attention"}>
                      {form.hasApiKey || form.apiKey ? "Configured" : "Missing"}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <WidgetPreview form={form} />
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        <InlineStack align="end" gap="300">
          <Button onClick={handleReset} disabled={!hasChanges}>
            Reset
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
