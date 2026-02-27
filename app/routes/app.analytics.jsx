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
  Divider,
  DataTable,
  ProgressBar,
  Select,
  Button,
  Tabs,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

const DAY_MS = 24 * 60 * 60 * 1000;

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const products = await fetchTopProducts(admin, 12);
  const conversations = [];

  return { products, conversations };
};

async function fetchTopProducts(admin, limit) {
  try {
    const response = await admin.graphql(
      `#graphql
      query AnalyticsTopProducts($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            id
            title
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
      name: product.title || "Untitled product",
      inventory:
        typeof product.totalInventory === "number" ? product.totalInventory : 0,
      price: formatPrice(product?.variants?.nodes?.[0]?.price),
      recs: 0,
      revenue: "-",
      trend: "n/a",
      trendUp: true,
    }));
  } catch (_error) {
    return [];
  }
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

function StatCard({ title, value, trend, trendUp, subtitle }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <InlineStack align="space-between" blockAlign="end">
          <Text as="p" variant="heading2xl" fontWeight="bold">
            {value}
          </Text>
          {trend ? (
            <Badge tone={trendUp ? "success" : "critical"}>
              {trendUp ? "+" : "-"} {trend}
            </Badge>
          ) : null}
        </InlineStack>
        {subtitle ? (
          <Text as="p" variant="bodySm" tone="subdued">
            {subtitle}
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}

function VerticalBarChart({ data, color }) {
  if (!data.length) {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        No chart data for this range.
      </Text>
    );
  }

  const max = Math.max(1, ...data.map((item) => item.value));
  const chartHeight = 120;

  return (
    <Box>
      <InlineStack gap="300" blockAlign="end" wrap={false}>
        {data.map((item) => {
          const barHeight = Math.max(6, Math.round((item.value / max) * chartHeight));
          return (
            <BlockStack key={item.label} gap="100" align="center">
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {item.value}
              </Text>
              <Box
                background={color || "bg-fill-success"}
                borderRadius="100"
                minWidth="36px"
                style={{ height: `${barHeight}px` }}
              />
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {item.label}
              </Text>
            </BlockStack>
          );
        })}
      </InlineStack>
    </Box>
  );
}

function HorizontalBarChart({ data, tone }) {
  if (!data.length) {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        No data available.
      </Text>
    );
  }

  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <BlockStack gap="300">
      {data.map((item) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <BlockStack key={item.label} gap="100">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {item.label}
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Text as="p" variant="bodySm" tone="subdued">
                  {item.value}
                </Text>
                <Badge>{pct}%</Badge>
              </InlineStack>
            </InlineStack>
            <ProgressBar progress={pct} size="small" tone={tone || "success"} />
          </BlockStack>
        );
      })}
    </BlockStack>
  );
}

function SegmentChart({ data }) {
  if (!data.length) {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        No ratings data available.
      </Text>
    );
  }

  return (
    <BlockStack gap="300">
      {data.map((item) => (
        <BlockStack key={item.label} gap="100">
          <InlineStack align="space-between">
            <Text as="p" variant="bodyMd">
              {item.label}
            </Text>
            <Badge tone={item.tone}>{item.value}%</Badge>
          </InlineStack>
          <ProgressBar
            progress={item.value}
            size="small"
            tone={item.tone === "attention" ? "highlight" : item.tone}
          />
        </BlockStack>
      ))}
    </BlockStack>
  );
}

function rangeToDays(range) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function parseTimestamp(item) {
  const value = item?.startedAtIso || item?.createdAt || item?.timestamp;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bucketLabels(range, now) {
  if (range === "7d") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getTime() - (6 - index) * DAY_MS);
      return date.toLocaleDateString("en-US", { weekday: "short" });
    });
  }

  if (range === "30d") {
    return ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
  }

  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (2 - index), 1);
    return date.toLocaleDateString("en-US", { month: "short" });
  });
}

function buildSessionBars(conversations, range, now) {
  const labels = bucketLabels(range, now);
  const bars = labels.map((label) => ({ label, value: 0 }));

  if (!conversations.length) {
    return bars;
  }

  const days = rangeToDays(range);
  const threshold = now.getTime() - days * DAY_MS;

  conversations.forEach((conversation) => {
    const stamp = parseTimestamp(conversation);
    if (!stamp || stamp.getTime() < threshold) return;

    if (range === "7d") {
      const diffDays = Math.floor((now.getTime() - stamp.getTime()) / DAY_MS);
      const targetIndex = 6 - diffDays;
      if (bars[targetIndex]) bars[targetIndex].value += 1;
      return;
    }

    if (range === "30d") {
      const diffDays = Math.floor((now.getTime() - stamp.getTime()) / DAY_MS);
      const weekIndex = Math.min(4, Math.floor((29 - diffDays) / 7));
      if (bars[weekIndex]) bars[weekIndex].value += 1;
      return;
    }

    const monthDiff =
      (now.getFullYear() - stamp.getFullYear()) * 12 +
      (now.getMonth() - stamp.getMonth());
    const monthIndex = 2 - monthDiff;
    if (bars[monthIndex]) bars[monthIndex].value += 1;
  });

  return bars;
}

function topQueryData(conversations) {
  const counts = new Map();

  conversations.forEach((conversation) => {
    const query = String(conversation.firstMessage || "").trim();
    if (!query) return;
    counts.set(query, (counts.get(query) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
}

function buildRangeData({ conversations, products, range }) {
  const now = new Date();
  const days = rangeToDays(range);
  const threshold = now.getTime() - days * DAY_MS;
  const inRange = conversations.filter((conversation) => {
    const stamp = parseTimestamp(conversation);
    return stamp && stamp.getTime() >= threshold;
  });

  const totalSessions = inRange.length;
  const totalMessages = inRange.reduce(
    (sum, conversation) => sum + (Number(conversation.messages) || 0),
    0,
  );
  const avgMessages = totalSessions
    ? (totalMessages / totalSessions).toFixed(1)
    : "0.0";
  const resolvedCount = inRange.filter(
    (conversation) => conversation.status === "resolved",
  ).length;
  const conversion = totalSessions
    ? `${((resolvedCount / totalSessions) * 100).toFixed(1)}%`
    : "0.0%";

  const bars = buildSessionBars(inRange, range, now);
  const peak = bars.reduce(
    (best, bar) => (bar.value > best.value ? bar : best),
    { label: "-", value: 0 },
  );

  return {
    kpi: {
      sessions: totalSessions,
      messages: totalMessages,
      avgLength: `${avgMessages} msgs`,
      conversion,
      convTrend: null,
      convUp: true,
    },
    bars,
    peakDay: peak.value ? `${peak.label} (${peak.value})` : "No sessions",
    total: bars.reduce((sum, bar) => sum + bar.value, 0),
    avg: bars.length
      ? bars.reduce((sum, bar) => sum + bar.value, 0) / bars.length
      : 0,
    queries: topQueryData(inRange),
    satisfaction: [],
    channels: [],
    products: products.map((product) => ({
      name: product.name,
      recs: product.recs,
      revenue: product.revenue,
      trend: product.trend,
      trendUp: product.trendUp,
      inventory: product.inventory,
      price: product.price,
    })),
  };
}

export default function Analytics() {
  const { conversations, products } = useLoaderData();
  const [dateRange, setDateRange] = useState("30d");
  const [selectedTab, setSelectedTab] = useState(0);

  const data = useMemo(
    () => buildRangeData({ conversations, products, range: dateRange }),
    [conversations, products, dateRange],
  );

  const dateOptions = [
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "Last 90 days", value: "90d" },
  ];

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "queries", content: "Top Queries" },
    { id: "products", content: "Products" },
  ];

  const handleTabChange = useCallback((index) => setSelectedTab(index), []);

  const productRows = useMemo(
    () =>
      data.products.map((product) => [
        product.name,
        product.inventory,
        product.price,
        <Badge key={product.name} tone={product.trendUp ? "success" : "critical"}>
          {product.trend}
        </Badge>,
      ]),
    [data.products],
  );

  const insights = useMemo(() => {
    if (!conversations.length) {
      return [
        { icon: "i", text: "No conversation logs found yet. Start by testing the storefront widget." },
        { icon: "i", text: "Once chat events are stored, this page will calculate session, query, and conversion metrics automatically." },
      ];
    }

    const topQuery = data.queries[0];
    return [
      topQuery
        ? {
            icon: "i",
            text: `"${topQuery.label}" is currently your most common customer question.`,
          }
        : { icon: "i", text: "No query insights available for this range." },
      {
        icon: "i",
        text: `Peak period in this range: ${data.peakDay}.`,
      },
    ];
  }, [conversations.length, data.queries, data.peakDay]);

  return (
    <Page>
      <TitleBar title="Analytics">
        <button variant="primary">Export Report</button>
      </TitleBar>

      <BlockStack gap="600">
        <InlineStack align="end" gap="300">
          <Box minWidth="180px">
            <Select
              label="Date range"
              labelHidden
              options={dateOptions}
              value={dateRange}
              onChange={setDateRange}
            />
          </Box>
        </InlineStack>

        <Layout>
          {[
            {
              title: "Total Sessions",
              value: data.kpi.sessions.toLocaleString(),
              subtitle: "From stored chat logs",
            },
            {
              title: "Total Messages",
              value: data.kpi.messages.toLocaleString(),
              subtitle: "User + bot messages",
            },
            {
              title: "Avg. Session Size",
              value: data.kpi.avgLength,
              subtitle: "Average messages per session",
            },
            {
              title: "Resolved Rate",
              value: data.kpi.conversion,
              subtitle: "Resolved conversations / total sessions",
            },
          ].map((stat) => (
            <Layout.Section key={stat.title} variant="oneQuarter">
              <StatCard {...stat} />
            </Layout.Section>
          ))}
        </Layout>

        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              {selectedTab === 0 ? (
                <Layout>
                  <Layout.Section>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Sessions Over Period
                        </Text>
                        <Badge tone="info">{dateOptions.find((opt) => opt.value === dateRange)?.label}</Badge>
                      </InlineStack>
                      <Divider />
                      <VerticalBarChart data={data.bars} color="bg-fill-success" />
                      <Divider />
                      <InlineStack gap="600">
                        {[
                          { label: "Peak", value: data.peakDay },
                          { label: "Total", value: `${data.total.toLocaleString()} sessions` },
                          { label: "Average", value: `${data.avg.toFixed(1)} per bucket` },
                        ].map(({ label, value }) => (
                          <BlockStack key={label} gap="050">
                            <Text as="p" variant="bodySm" tone="subdued">
                              {label}
                            </Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              {value}
                            </Text>
                          </BlockStack>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <BlockStack gap="500">
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">
                          Response Quality
                        </Text>
                        <Divider />
                        <SegmentChart data={data.satisfaction} />
                      </BlockStack>

                      <Divider />

                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">
                          Where Chats Start
                        </Text>
                        <Divider />
                        <SegmentChart data={data.channels.map((entry) => ({ ...entry, tone: "info" }))} />
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              ) : null}

              {selectedTab === 1 ? (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Top Customer Queries
                    </Text>
                    <Button variant="plain" url="/app/chat-logs">
                      View full logs
                    </Button>
                  </InlineStack>
                  <Divider />
                  <HorizontalBarChart data={data.queries} tone="success" />
                </BlockStack>
              ) : null}

              {selectedTab === 2 ? (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Store Products
                    </Text>
                    <Badge tone="info">Live from Shopify</Badge>
                  </InlineStack>
                  <Divider />
                  {productRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "text", "text"]}
                      headings={["Product", "Inventory", "Price", "Trend"]}
                      rows={productRows}
                      footerContent={`Showing ${productRows.length} products`}
                    />
                  ) : (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      No products found.
                    </Text>
                  )}
                </BlockStack>
              ) : null}
            </Box>
          </Tabs>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Auto Insights
            </Text>
            <Divider />
            <BlockStack gap="300">
              {insights.map((insight) => (
                <Box
                  key={insight.text}
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <InlineStack gap="300" blockAlign="start">
                    <Text as="span" variant="bodyLg">
                      {insight.icon}
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {insight.text}
                    </Text>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Query Volume Distribution
                </Text>
                <Divider />
                <HorizontalBarChart data={data.queries.slice(0, 5)} tone="success" />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Session Source
                </Text>
                <Divider />
                <HorizontalBarChart data={data.channels} tone="info" />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
