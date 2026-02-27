import { useMemo, useState } from "react";
import {
  Page,
  Layout,
  InlineGrid,
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
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "active", content: "Active" },
  { id: "pending", content: "Pending" },
  { id: "resolved", content: "Resolved" },
];

const STATUS_TONE = { active: "success", resolved: "info", pending: "attention" };

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const conversations = [];
  const topProducts = await fetchTopProducts(admin, 7);
  const kpi = summarizeConversations(conversations);

  return {
    conversations,
    kpi,
    topProducts,
    setupSteps: buildSetupSteps({
      hasProducts: topProducts.length > 0,
      hasConversations: conversations.length > 0,
    }),
  };
};

function buildSetupSteps({ hasProducts, hasConversations }) {
  return [
    { id: "install", label: "Install the ChatBot app", done: true, href: null },
    { id: "products", label: "Sync products from your store", done: hasProducts, href: null },
    { id: "settings", label: "Configure bot settings", done: false, href: "/app/settings" },
    { id: "widget", label: "Add chat widget to your storefront", done: false, href: "/app/settings" },
    { id: "test", label: "Test your first conversation", done: hasConversations, href: "/app/chat-logs" },
  ];
}

function summarizeConversations(conversations) {
  const safe = Array.isArray(conversations) ? conversations : [];
  return {
    total: safe.length,
    active: safe.filter((c) => c.status === "active").length,
    pending: safe.filter((c) => c.status === "pending").length,
    resolved: safe.filter((c) => c.status === "resolved").length,
  };
}

async function fetchTopProducts(admin, limit) {
  try {
    const response = await admin.graphql(
      `#graphql
      query DashboardTopProducts($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            id
            title
            status
            totalInventory
            variants(first: 1) {
              nodes {
                price
              }
            }
          }
        }
      }
      `,
      { variables: { first: limit } },
    );

    const json = await response.json();
    const nodes = json?.data?.products?.nodes || [];

    return nodes.map((product) => ({
      id: product.id,
      title: product.title || "Untitled product",
      status: normalizeStatus(product.status),
      inventory:
        typeof product.totalInventory === "number" ? product.totalInventory : 0,
      price: formatPrice(product?.variants?.nodes?.[0]?.price),
    }));
  } catch (_error) {
    return [];
  }
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPrice(rawPrice) {
  const amount = Number(rawPrice);
  if (!Number.isFinite(amount)) return "-";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_error) {
    return `$${amount.toFixed(2)}`;
  }
}

function StatCard({ title, value, subtitle }) {
  return (
    <Card padding="300">
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="headingLg" fontWeight="bold">
          {value}
        </Text>
        {subtitle ? (
          <Text as="p" variant="bodyXs" tone="subdued">
            {subtitle}
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}

function ConversationRow({ name, initials, message, time, status }) {
  const safeMessage = String(message || "");
  const safeTime = String(time || "-");
  const safeStatus = String(status || "pending");
  return (
    <Box paddingBlock="300">
      <InlineStack align="space-between" blockAlign="center" gap="400">
        <InlineStack gap="300" blockAlign="center">
          <Avatar customer name={name} initials={initials} size="sm" />
          <BlockStack gap="050">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {name}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {safeMessage.length > 50
                ? `${safeMessage.slice(0, 50)}...`
                : safeMessage}
            </Text>
          </BlockStack>
        </InlineStack>
        <InlineStack gap="200" blockAlign="center">
          <Badge tone={STATUS_TONE[safeStatus] || "new"}>{safeStatus}</Badge>
          <Text as="p" variant="bodySm" tone="subdued">
            {safeTime}
          </Text>
        </InlineStack>
      </InlineStack>
    </Box>
  );
}

function ChecklistItem({ label, done, href }) {
  return (
    <InlineStack gap="200" blockAlign="center" align="space-between">
      <InlineStack gap="200" blockAlign="center">
        <Badge tone={done ? "success" : "attention"}>{done ? "Done" : "Pending"}</Badge>
        <Text
          as="p"
          variant="bodyMd"
          tone={done ? "subdued" : undefined}
          textDecorationLine={done ? "line-through" : undefined}
        >
          {label}
        </Text>
      </InlineStack>
      {href ? (
        <Button variant="plain" url={href}>
          Open
        </Button>
      ) : null}
    </InlineStack>
  );
}

export default function Dashboard() {
  const shopify = useAppBridge();
  const { conversations, kpi, topProducts, setupSteps } = useLoaderData();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [convTabIndex, setConvTabIndex] = useState(0);

  const filteredConversations = useMemo(() => {
    const activeTab = STATUS_TABS[convTabIndex].id;
    if (activeTab === "all") return conversations;
    return conversations.filter((conversation) => conversation.status === activeTab);
  }, [convTabIndex, conversations]);

  const doneCount = useMemo(
    () => setupSteps.filter((step) => step.done).length,
    [setupSteps],
  );
  const setupProgress = useMemo(
    () => Math.round((doneCount / setupSteps.length) * 100),
    [doneCount, setupSteps.length],
  );
  const allDone = doneCount === setupSteps.length;

  const topProductRows = useMemo(
    () =>
      topProducts.map((product) => [
        product.title,
        product.status,
        String(product.inventory),
        product.price,
      ]),
    [topProducts],
  );

  return (
    <Page>
      <TitleBar title="ChatBot Dashboard">
        <button
          variant="primary"
          onClick={() => shopify.toast.show("Open Settings to configure your chatbot")}
        >
          Configure Bot
        </button>
      </TitleBar>

      <BlockStack gap="600">
        {!bannerDismissed && !allDone ? (
          <Banner
            title="Complete your setup to activate the chatbot"
            tone="warning"
            action={{ content: "Go to Settings", url: "/app/settings" }}
            onDismiss={() => setBannerDismissed(true)}
          >
            <Text as="p" variant="bodyMd">
              {doneCount} of {setupSteps.length} steps done. {setupSteps.length - doneCount} remaining.
            </Text>
          </Banner>
        ) : null}

        {allDone ? (
          <Banner title="Your ChatBot is fully set up!" tone="success">
            <Text as="p" variant="bodyMd">
              All setup steps are complete. Your bot is ready to serve customers.
            </Text>
          </Banner>
        ) : null}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {[
            { title: "Total Conversations", value: kpi.total.toString(), subtitle: "From stored chat logs" },
            { title: "Active Conversations", value: kpi.active.toString(), subtitle: "Currently open" },
            { title: "Resolved Conversations", value: kpi.resolved.toString(), subtitle: "Marked resolved" },
            { title: "Products Synced", value: topProducts.length.toString(), subtitle: "Latest Shopify products" },
          ].map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Recent Conversations
                  </Text>
                  <Button variant="plain" url="/app/chat-logs">
                    View all
                  </Button>
                </InlineStack>
              </Box>

              <Tabs tabs={STATUS_TABS} selected={convTabIndex} onSelect={setConvTabIndex}>
                <Box paddingInline="400">
                  {filteredConversations.length === 0 ? (
                    <Box paddingBlock="500">
                      <EmptyState
                        heading={`No ${STATUS_TABS[convTabIndex].id} conversations`}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <Text as="p" variant="bodyMd">
                          Chat logs will appear here after customers start using the storefront chat.
                        </Text>
                      </EmptyState>
                    </Box>
                  ) : (
                    <BlockStack>
                      {filteredConversations.map((conversation, index) => (
                        <Box key={conversation.id}>
                          <ConversationRow {...conversation} />
                          {index < filteredConversations.length - 1 ? <Divider /> : null}
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </Box>
              </Tabs>

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
                      <Text as="span" variant="bodySm" tone="subdued">
                        {count}
                      </Text>
                    </InlineStack>
                  ))}
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Setup Checklist
                  </Text>
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm" tone="subdued">
                        {doneCount} of {setupSteps.length} completed
                      </Text>
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {setupProgress}%
                      </Text>
                    </InlineStack>
                    <ProgressBar progress={setupProgress} tone={allDone ? "success" : "highlight"} />
                  </BlockStack>

                  <BlockStack gap="300">
                    {setupSteps.map((step) => (
                      <ChecklistItem key={step.id} {...step} />
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Top Products
                    </Text>
                    <Button variant="plain" url="/app/analytics">
                      Analytics
                    </Button>
                  </InlineStack>
                  {topProductRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "text"]}
                      headings={["Product", "Status", "Inventory", "Price"]}
                      rows={topProductRows}
                      truncate
                    />
                  ) : (
                    <Text as="p" variant="bodySm" tone="subdued">
                      No products found. Add products in Shopify Admin to populate this section.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Quick Actions
                  </Text>
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
      </BlockStack>
    </Page>
  );
}
