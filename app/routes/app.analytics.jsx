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
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// ─── Dataset per date range ───────────────────────────────────────────────────
const RANGE_DATA = {
  "7d": {
    kpi: { sessions: 342, messages: 2180, avgLength: "2m 48s", conversion: "5.8%", convTrend: "0.6%", convUp: false },
    bars: [
      { label: "Mon", value: 42 }, { label: "Tue", value: 67 },
      { label: "Wed", value: 53 }, { label: "Thu", value: 88 },
      { label: "Fri", value: 95 }, { label: "Sat", value: 74 },
      { label: "Sun", value: 38 },
    ],
    peakDay: "Friday (95 chats)", total: 457, avg: 65.3,
    queries: [
      { label: "Show me running shoes", value: 48 },
      { label: "What's on sale?", value: 41 },
      { label: "Best wireless headphones", value: 33 },
      { label: "Return policy", value: 28 },
      { label: "Track my order", value: 22 },
    ],
    satisfaction: [
      { label: "Helpful", value: 71, tone: "success" },
      { label: "Neutral", value: 20, tone: "attention" },
      { label: "Not helpful", value: 9, tone: "critical" },
    ],
    channels: [
      { label: "Product pages", value: 61 },
      { label: "Home page", value: 20 },
      { label: "Collections", value: 11 },
      { label: "Cart page", value: 8 },
    ],
    products: [
      { name: "Nike Air Max 270", recs: 12, revenue: "$1,440", trend: "↑ 14%", trendUp: true },
      { name: "Wireless Earbuds Pro", recs: 9, revenue: "$719.91", trend: "↑ 9%", trendUp: true },
      { name: "Classic Denim Jacket", recs: 7, revenue: "$623.00", trend: "↓ 2%", trendUp: false },
      { name: "Running Shorts", recs: 6, revenue: "$210.00", trend: "↑ 3%", trendUp: true },
      { name: "Yoga Mat Premium", recs: 5, revenue: "$225.00", trend: "↑ 22%", trendUp: true },
    ],
  },
  "30d": {
    kpi: { sessions: 1284, messages: 8942, avgLength: "3m 12s", conversion: "6.4%", convTrend: "1.2%", convUp: false },
    bars: [
      { label: "W1", value: 280 }, { label: "W2", value: 340 },
      { label: "W3", value: 390 }, { label: "W4", value: 457 },
    ],
    peakDay: "Week 4 (457 chats)", total: 1467, avg: 336.8,
    queries: [
      { label: "Show me running shoes", value: 148 },
      { label: "What's on sale?", value: 134 },
      { label: "Best wireless headphones", value: 112 },
      { label: "Return policy", value: 98 },
      { label: "Track my order", value: 76 },
      { label: "Gift ideas under $50", value: 63 },
      { label: "Summer collection", value: 55 },
    ],
    satisfaction: [
      { label: "Helpful", value: 74, tone: "success" },
      { label: "Neutral", value: 18, tone: "attention" },
      { label: "Not helpful", value: 8, tone: "critical" },
    ],
    channels: [
      { label: "Product pages", value: 58 },
      { label: "Home page", value: 22 },
      { label: "Collections", value: 12 },
      { label: "Cart page", value: 8 },
    ],
    products: [
      { name: "Nike Air Max 270", recs: 34, revenue: "$4,080", trend: "↑ 12%", trendUp: true },
      { name: "Wireless Earbuds Pro", recs: 28, revenue: "$2,239.72", trend: "↑ 8%", trendUp: true },
      { name: "Classic Denim Jacket", recs: 22, revenue: "$1,958", trend: "↓ 3%", trendUp: false },
      { name: "Running Shorts", recs: 19, revenue: "$665", trend: "↑ 5%", trendUp: true },
      { name: "Yoga Mat Premium", recs: 15, revenue: "$675", trend: "↑ 20%", trendUp: true },
      { name: "Blue Hoodie", recs: 13, revenue: "$845", trend: "↑ 2%", trendUp: true },
      { name: "Canvas Sneakers", recs: 11, revenue: "$484", trend: "↓ 7%", trendUp: false },
    ],
  },
  "90d": {
    kpi: { sessions: 3890, messages: 27400, avgLength: "3m 31s", conversion: "7.1%", convTrend: "0.9%", convUp: true },
    bars: [
      { label: "Jan", value: 1100 }, { label: "Feb", value: 1280 },
      { label: "Mar", value: 1510 },
    ],
    peakDay: "March (1,510 chats)", total: 3890, avg: 1296.7,
    queries: [
      { label: "Show me running shoes", value: 410 },
      { label: "What's on sale?", value: 380 },
      { label: "Best wireless headphones", value: 290 },
      { label: "Return policy", value: 270 },
      { label: "Track my order", value: 210 },
      { label: "Gift ideas under $50", value: 185 },
      { label: "Summer collection", value: 155 },
      { label: "Size guide", value: 130 },
    ],
    satisfaction: [
      { label: "Helpful", value: 76, tone: "success" },
      { label: "Neutral", value: 16, tone: "attention" },
      { label: "Not helpful", value: 8, tone: "critical" },
    ],
    channels: [
      { label: "Product pages", value: 55 },
      { label: "Home page", value: 25 },
      { label: "Collections", value: 13 },
      { label: "Cart page", value: 7 },
    ],
    products: [
      { name: "Nike Air Max 270", recs: 98, revenue: "$11,760", trend: "↑ 15%", trendUp: true },
      { name: "Wireless Earbuds Pro", recs: 82, revenue: "$6,559.18", trend: "↑ 11%", trendUp: true },
      { name: "Classic Denim Jacket", recs: 65, revenue: "$5,785", trend: "↓ 1%", trendUp: false },
      { name: "Running Shorts", recs: 58, revenue: "$2,030", trend: "↑ 8%", trendUp: true },
      { name: "Yoga Mat Premium", recs: 45, revenue: "$2,025", trend: "↑ 25%", trendUp: true },
      { name: "Blue Hoodie", recs: 40, revenue: "$2,600", trend: "↑ 4%", trendUp: true },
      { name: "Canvas Sneakers", recs: 34, revenue: "$1,496", trend: "↓ 4%", trendUp: false },
    ],
  },
};

// ─── Polaris Stat Card ─────────────────────────────────────────────────────────
function StatCard({ title, value, trend, trendUp, subtitle }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">{title}</Text>
        <InlineStack align="space-between" blockAlign="end">
          <Text as="p" variant="heading2xl" fontWeight="bold">{value}</Text>
          {trend && (
            <Badge tone={trendUp ? "success" : "critical"}>
              {trendUp ? "▲" : "▼"} {trend}
            </Badge>
          )}
        </InlineStack>
        {subtitle && (
          <Text as="p" variant="bodySm" tone="subdued">{subtitle}</Text>
        )}
      </BlockStack>
    </Card>
  );
}

// ─── Vertical Bar Chart — Polaris Box + ProgressBar label ─────────────────────
function VerticalBarChart({ data, color }) {
  const max = Math.max(...data.map((d) => d.value));
  const CHART_HEIGHT = 120;
  return (
    <Box>
      <InlineStack gap="300" blockAlign="end" wrap={false}>
        {data.map((item) => {
          const barH = Math.max(6, Math.round((item.value / max) * CHART_HEIGHT));
          return (
            <BlockStack key={item.label} gap="100" align="center">
              {/* Value label on top */}
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {item.value}
              </Text>
              {/* Polaris Box — uses Polaris background token + inline height only */}
              <Box
                background={color || "bg-fill-success"}
                borderRadius="100"
                minWidth="36px"
                style={{ height: `${barH}px` }}
              />
              {/* Day label below */}
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

// ─── Horizontal Bar Chart — 100% Polaris ProgressBar ─────────────────────────
function HorizontalBarChart({ data, tone }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <BlockStack gap="300">
      {data.map((item) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <BlockStack key={item.label} gap="100">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">{item.label}</Text>
              <InlineStack gap="200" blockAlign="center">
                <Text as="p" variant="bodySm" tone="subdued">{item.value}</Text>
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

// ─── Donut-like Segment Chart — 100% Polaris ProgressBar stacked ──────────────
function SegmentChart({ data }) {
  return (
    <BlockStack gap="300">
      {data.map((item) => (
        <BlockStack key={item.label} gap="100">
          <InlineStack align="space-between">
            <Text as="p" variant="bodyMd">{item.label}</Text>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [dateRange, setDateRange] = useState("30d");
  const [selectedTab, setSelectedTab] = useState(0);

  const data = useMemo(() => RANGE_DATA[dateRange], [dateRange]);

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

  const handleTabChange = useCallback((i) => setSelectedTab(i), []);

  // Compute product table rows dynamically
  const productRows = useMemo(
    () =>
      data.products.map((p) => [
        p.name,
        p.recs,
        p.revenue,
        <Badge key={p.name} tone={p.trendUp ? "success" : "critical"}>
          {p.trend}
        </Badge>,
      ]),
    [data.products],
  );

  // Compute insights dynamically from data
  const insights = useMemo(() => {
    const topQuery = data.queries[0];
    const topProduct = data.products[0];
    const bestGrowth = [...data.products].sort((a, b) => {
      const aNum = parseFloat(a.trend.replace(/[^0-9.]/g, ""));
      const bNum = parseFloat(b.trend.replace(/[^0-9.]/g, ""));
      return b.trend.startsWith("↑") ? bNum - aNum : aNum - bNum;
    })[0];
    return [
      { icon: "💡", text: `"${topQuery.label}" is your #1 query. Consider adding a pinned answer in your bot.` },
      { icon: "📈", text: `${bestGrowth.name} is trending with ${bestGrowth.trend} growth in recommendations.` },
      { icon: "⚡", text: `${data.peakDay} was your peak. Ensure your AI API key has enough quota on busy days.` },
    ];
  }, [data]);

  return (
    <Page>
      <TitleBar title="Analytics">
        <button variant="primary">Export Report</button>
      </TitleBar>

      <BlockStack gap="600">
        {/* ── Date Range Selector ──────────────────────────── */}
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

        {/* ── KPI Cards — all values update with dateRange ─── */}
        <Layout>
          {[
            { title: "Total Sessions", value: data.kpi.sessions.toLocaleString(), trend: "18%", trendUp: true, subtitle: "vs previous period" },
            { title: "Total Messages", value: data.kpi.messages.toLocaleString(), trend: "23%", trendUp: true, subtitle: "bot + customer" },
            { title: "Avg. Session Length", value: data.kpi.avgLength, trend: "0:24", trendUp: true, subtitle: "per conversation" },
            { title: "Chat-to-Purchase", value: data.kpi.conversion, trend: data.kpi.convTrend, trendUp: data.kpi.convUp, subtitle: "conversion rate" },
          ].map((stat) => (
            <Layout.Section key={stat.title} variant="oneQuarter">
              <StatCard {...stat} />
            </Layout.Section>
          ))}
        </Layout>

        {/* ── Tabbed Charts ────────────────────────────────── */}
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              {/* TAB 0: Overview */}
              {selectedTab === 0 && (
                <Layout>
                  {/* Vertical Bar Chart */}
                  <Layout.Section>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Sessions Over Period
                        </Text>
                        <Badge tone="success">
                          +18% vs previous
                        </Badge>
                      </InlineStack>
                      <Divider />

                      <VerticalBarChart data={data.bars} color="bg-fill-success" />

                      <Divider />
                      <InlineStack gap="600">
                        {[
                          { label: "Peak", value: data.peakDay },
                          { label: "Total", value: data.total.toLocaleString() + " chats" },
                          { label: "Average", value: data.avg.toFixed(1) + " / period" },
                        ].map(({ label, value }) => (
                          <BlockStack key={label} gap="050">
                            <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{value}</Text>
                          </BlockStack>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  </Layout.Section>

                  {/* Sidebar Charts */}
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="500">
                      {/* Response Quality */}
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">Response Quality</Text>
                        <Divider />
                        <SegmentChart data={data.satisfaction} />
                        <Text as="p" variant="bodySm" tone="subdued">
                          Based on customer ratings.
                        </Text>
                      </BlockStack>

                      <Divider />

                      {/* Where chats start */}
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">Where Chats Start</Text>
                        <Divider />
                        <SegmentChart data={data.channels.map(c => ({ ...c, tone: "info" }))} />
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              )}

              {/* TAB 1: Top Queries */}
              {selectedTab === 1 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Top Customer Queries</Text>
                    <Button variant="plain" url="/app/chat-logs">View full logs</Button>
                  </InlineStack>
                  <Divider />
                  <HorizontalBarChart data={data.queries} tone="success" />
                </BlockStack>
              )}

              {/* TAB 2: Products */}
              {selectedTab === 2 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Top Recommended Products</Text>
                    <Badge tone="info">
                      Last {dateRange === "7d" ? "7" : dateRange === "30d" ? "30" : "90"} days
                    </Badge>
                  </InlineStack>
                  <Divider />
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric", "text"]}
                    headings={["Product", "Recommendations", "Revenue Influenced", "Trend"]}
                    rows={productRows}
                    footerContent={`Showing ${data.products.length} products`}
                  />
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </Card>

        {/* ── Insights Card — computed from live data ────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Auto Insights</Text>
            <Divider />
            <BlockStack gap="300">
              {insights.map((insight, i) => (
                <Box
                  key={i}
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <InlineStack gap="300" blockAlign="start">
                    <Text as="span" variant="bodyLg">{insight.icon}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">{insight.text}</Text>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        {/* ── Response Quality + Channel — always visible below tabs ── */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Query Volume Distribution</Text>
                <Divider />
                <HorizontalBarChart data={data.queries.slice(0, 5)} tone="success" />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Session Source</Text>
                <Divider />
                <HorizontalBarChart
                  data={data.channels.map((c) => ({ label: c.label, value: c.value }))}
                  tone="info"
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
