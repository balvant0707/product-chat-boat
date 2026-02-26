import { useState, useMemo, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  Button,
  Divider,
  Banner,
  ProgressBar,
  DataTable,
  EmptyState,
  Tabs,
  Avatar,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// ─── Static seed data ─────────────────────────────────────────────────────────
const ALL_CONVERSATIONS = [
  { id: 1, name: "Sarah Johnson", initials: "SJ", message: "Looking for a red dress under $50", time: "2 min ago", status: "active" },
  { id: 2, name: "Mike Chen", initials: "MC", message: "Do you have wireless headphones?", time: "15 min ago", status: "resolved" },
  { id: 3, name: "Priya Sharma", initials: "PS", message: "What's the return policy for shoes?", time: "32 min ago", status: "resolved" },
  { id: 4, name: "Guest User", initials: "GU", message: "Show me your best selling products", time: "1 hr ago", status: "pending" },
  { id: 5, name: "Alex Rivera", initials: "AR", message: "Is the blue hoodie available in XL?", time: "2 hr ago", status: "resolved" },
  { id: 6, name: "Emma Wilson", initials: "EW", message: "Gift ideas under $100 please", time: "3 hr ago", status: "resolved" },
];

const INITIAL_SETUP = [
  { id: "install", label: "Install the ChatBot app", done: true, href: null },
  { id: "settings", label: "Configure bot settings", done: false, href: "/app/settings" },
  { id: "widget", label: "Add chat widget to your storefront", done: false, href: "/app/settings" },
  { id: "apikey", label: "Set up AI API key", done: false, href: "/app/settings" },
  { id: "test", label: "Test your first conversation", done: false, href: null },
];

const TOP_PRODUCTS = [
  ["Nike Air Max 270", "34 times", "$120.00", "↑ 12%"],
  ["Wireless Earbuds Pro", "28 times", "$79.99", "↑ 8%"],
  ["Classic Denim Jacket", "22 times", "$89.00", "↓ 3%"],
  ["Running Shorts", "19 times", "$35.00", "↑ 5%"],
  ["Yoga Mat Premium", "15 times", "$45.00", "↑ 20%"],
];

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "active", content: "Active" },
  { id: "pending", content: "Pending" },
  { id: "resolved", content: "Resolved" },
];

const STATUS_TONE = { active: "success", resolved: "info", pending: "attention" };

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, trend, trendUp, subtitle }) {
  return (
    <Card padding="300">
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">{title}</Text>
        <InlineStack align="space-between" blockAlign="end">
          <Text as="p" variant="headingLg" fontWeight="bold">{value}</Text>
          {trend && (
            <Badge tone={trendUp ? "success" : "critical"}>
              {trendUp ? "▲" : "▼"} {trend}
            </Badge>
          )}
        </InlineStack>
        {subtitle && (
          <Text as="p" variant="bodyXs" tone="subdued">{subtitle}</Text>
        )}
      </BlockStack>
    </Card>
  );
}

// ─── Conversation Row ─────────────────────────────────────────────────────────
function ConversationRow({ name, initials, message, time, status }) {
  return (
    <Box paddingBlock="300">
      <InlineStack align="space-between" blockAlign="center" gap="400">
        <InlineStack gap="300" blockAlign="center">
          <Avatar customer name={name} initials={initials} size="sm" />
          <BlockStack gap="050">
            <Text as="p" variant="bodyMd" fontWeight="semibold">{name}</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {message.length > 50 ? message.slice(0, 50) + "…" : message}
            </Text>
          </BlockStack>
        </InlineStack>
        <InlineStack gap="200" blockAlign="center">
          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
          <Text as="p" variant="bodySm" tone="subdued">{time}</Text>
        </InlineStack>
      </InlineStack>
    </Box>
  );
}

// ─── Checklist Item — interactive toggle ──────────────────────────────────────
function ChecklistItem({ label, done, href, onToggle }) {
  return (
    <InlineStack gap="200" blockAlign="center">
      <Box
        as="button"
        onClick={onToggle}
        width="22px"
        minHeight="22px"
        background={done ? "bg-fill-success" : "bg-surface-active"}
        borderRadius="full"
        borderWidth="025"
        borderColor={done ? "border-success" : "border"}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Text as="span" variant="bodySm" tone={done ? "success" : "subdued"}>
          {done ? "✓" : ""}
        </Text>
      </Box>
      {href ? (
        <Button variant="plain" url={href} textAlign="left">
          {label}
        </Button>
      ) : (
        <Text
          as="p"
          variant="bodyMd"
          tone={done ? "subdued" : undefined}
          textDecorationLine={done ? "line-through" : undefined}
        >
          {label}
        </Text>
      )}
    </InlineStack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const shopify = useAppBridge();

  // ── Setup checklist state ──────────────────────────────
  const [setupSteps, setSetupSteps] = useState(INITIAL_SETUP);

  const toggleStep = useCallback((id) => {
    setSetupSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );
  }, []);

  const doneCount = useMemo(
    () => setupSteps.filter((s) => s.done).length,
    [setupSteps],
  );
  const setupProgress = useMemo(
    () => Math.round((doneCount / setupSteps.length) * 100),
    [doneCount, setupSteps.length],
  );
  const allDone = doneCount === setupSteps.length;

  // ── Banner dismiss ─────────────────────────────────────
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Conversation filter tabs ───────────────────────────
  const [convTabIndex, setConvTabIndex] = useState(0);

  const filteredConversations = useMemo(() => {
    const activeTab = STATUS_TABS[convTabIndex].id;
    if (activeTab === "all") return ALL_CONVERSATIONS;
    return ALL_CONVERSATIONS.filter((c) => c.status === activeTab);
  }, [convTabIndex]);

  // ── KPI counts derived from conversations ──────────────
  const kpi = useMemo(() => ({
    total: ALL_CONVERSATIONS.length,
    active: ALL_CONVERSATIONS.filter((c) => c.status === "active").length,
    pending: ALL_CONVERSATIONS.filter((c) => c.status === "pending").length,
    resolved: ALL_CONVERSATIONS.filter((c) => c.status === "resolved").length,
  }), []);

  return (
    <Page>
      <TitleBar title="ChatBot Dashboard">
        <button variant="primary" onClick={() => shopify.toast.show("Redirecting to settings…")}>
          Configure Bot
        </button>
      </TitleBar>

      <BlockStack gap="600">
        {/* ── Banner ─────────────────────────────────────── */}
        {!bannerDismissed && !allDone && (
          <Banner
            title="Complete your setup to activate the chatbot"
            tone="warning"
            action={{ content: "Go to Settings", url: "/app/settings" }}
            onDismiss={() => setBannerDismissed(true)}
          >
            <Text as="p" variant="bodyMd">
              {doneCount} of {setupSteps.length} steps done —{" "}
              {setupSteps.length - doneCount} remaining.
            </Text>
          </Banner>
        )}
        {allDone && (
          <Banner
            title="Your ChatBot is fully set up!"
            tone="success"
            onDismiss={() => {}}
          >
            <Text as="p" variant="bodyMd">
              All setup steps are complete. Your bot is live on the storefront.
            </Text>
          </Banner>
        )}

        {/* ── KPI Stats ──────────────────────────────────── */}
        <Layout>
          {[
            { title: "Total Conversations", value: "1,284", trend: "18%", trendUp: true, subtitle: "vs last 30 days" },
            { title: "Messages Today", value: "342", trend: "5%", trendUp: true, subtitle: "across all sessions" },
            { title: "Products Recommended", value: "876", trend: "23%", trendUp: true, subtitle: "this month" },
            { title: "Conversion Rate", value: "6.4%", trend: "1.2%", trendUp: false, subtitle: "chat-to-purchase" },
          ].map((stat) => (
            <Layout.Section key={stat.title} variant="oneFourth">
              <StatCard {...stat} />
            </Layout.Section>
          ))}
        </Layout>

        {/* ── Main Content ───────────────────────────────── */}
        <Layout>
          {/* Recent Conversations with Tabs */}
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Recent Conversations</Text>
                  <Button variant="plain" url="/app/chat-logs">View all</Button>
                </InlineStack>
              </Box>
              <Tabs
                tabs={STATUS_TABS}
                selected={convTabIndex}
                onSelect={setConvTabIndex}
              >
                <Box paddingInline="400">
                  {filteredConversations.length === 0 ? (
                    <Box paddingBlock="500">
                      <EmptyState
                        heading={`No ${STATUS_TABS[convTabIndex].id} conversations`}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <Text as="p" variant="bodyMd">
                          No conversations with this status right now.
                        </Text>
                      </EmptyState>
                    </Box>
                  ) : (
                    <BlockStack>
                      {filteredConversations.map((conv, i) => (
                        <Box key={conv.id}>
                          <ConversationRow {...conv} />
                          {i < filteredConversations.length - 1 && <Divider />}
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </Box>
              </Tabs>

              {/* Live count footer */}
              <Divider />
              <Box padding="300">
                <InlineStack gap="400">
                  {[
                    { label: "Active", count: kpi.active, tone: "success" },
                    { label: "Pending", count: kpi.pending, tone: "attention" },
                    { label: "Resolved", count: kpi.resolved, tone: "info" },
                  ].map(({ label, count, tone }) => (
                    <InlineStack key={label} gap="150" blockAlign="center">
                      <Badge tone={tone}>{label}</Badge>
                      <Text as="span" variant="bodySm" tone="subdued">{count}</Text>
                    </InlineStack>
                  ))}
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>

          {/* Sidebar */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Interactive Setup Checklist */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Setup Checklist</Text>
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm" tone="subdued">
                        {doneCount} of {setupSteps.length} completed
                      </Text>
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {setupProgress}%
                      </Text>
                    </InlineStack>
                    <ProgressBar
                      progress={setupProgress}
                      tone={allDone ? "success" : "highlight"}
                    />
                  </BlockStack>
                  <BlockStack gap="300">
                    {setupSteps.map((step) => (
                      <ChecklistItem
                        key={step.id}
                        {...step}
                        onToggle={() => toggleStep(step.id)}
                      />
                    ))}
                  </BlockStack>
                  {allDone && (
                    <Box
                      padding="200"
                      background="bg-fill-success"
                      borderRadius="200"
                    >
                      <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="semibold">
                        Setup complete — ChatBot is ready!
                      </Text>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              {/* Top Recommended Products */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Top Products</Text>
                    <Button variant="plain" url="/app/analytics">Analytics</Button>
                  </InlineStack>
                  <DataTable
                    columnContentTypes={["text", "text", "numeric", "text"]}
                    headings={["Product", "Mentions", "Price", "Trend"]}
                    rows={TOP_PRODUCTS}
                    truncate
                  />
                </BlockStack>
              </Card>

              {/* Quick Actions */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Quick Actions</Text>
                  <BlockStack gap="200">
                    <Button url="/app/settings" fullWidth variant="primary">
                      Configure ChatBot
                    </Button>
                    <Button url="/app/chat-logs" fullWidth>
                      View Chat Logs
                    </Button>
                    <Button url="/app/analytics" fullWidth>
                      View Analytics
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* ── Tips Row ───────────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Tips to improve your ChatBot</Text>
            <Layout>
              {[
                {
                  title: "Add detailed product descriptions",
                  body: "The AI uses your product descriptions to answer customer questions. Richer descriptions mean better answers.",
                },
                {
                  title: "Set a friendly welcome message",
                  body: "A warm greeting increases chat engagement. Customize it in the Settings page.",
                },
                {
                  title: "Review chat logs regularly",
                  body: "Spot unanswered questions and improve your bot's responses over time.",
                },
              ].map(({ title, body }) => (
                <Layout.Section key={title} variant="oneThird">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">{title}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{body}</Text>
                  </BlockStack>
                </Layout.Section>
              ))}
            </Layout>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
