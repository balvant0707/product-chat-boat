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
  TextField,
  Select,
  IndexTable,
  useIndexResourceState,
  Modal,
  Avatar,
  EmptyState,
  Pagination,
  Tabs,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// ─── Seed Data ────────────────────────────────────────────────────────────────
const CONVERSATIONS = [
  {
    id: "1", customer: "Sarah Johnson", email: "sarah.j@email.com",
    firstMessage: "Looking for a red dress under $50",
    messages: 8, products: 3, status: "resolved",
    startedAt: "Feb 26, 2026 · 2:14 PM", duration: "4m 32s",
    thread: [
      { role: "bot", text: "Hi! I'm here to help you find the perfect product. What are you looking for?" },
      { role: "user", text: "Looking for a red dress under $50" },
      { role: "bot", text: "Here are some red dresses under $50:\n1. Floral Sundress — $39.99\n2. Classic Red Midi — $44.99\n3. Party Wrap Dress — $49.00" },
      { role: "user", text: "Tell me more about the Floral Sundress" },
      { role: "bot", text: "The Floral Sundress is a lightweight summer dress with a floral print. Available in XS–XL, ships in 3–5 days." },
      { role: "user", text: "Yes please!" },
      { role: "bot", text: "You can add it to your cart here: [Floral Sundress]. Anything else?" },
      { role: "user", text: "No thanks!" },
    ],
  },
  {
    id: "2", customer: "Mike Chen", email: "mike.c@email.com",
    firstMessage: "Do you have wireless headphones?",
    messages: 5, products: 2, status: "resolved",
    startedAt: "Feb 26, 2026 · 1:52 PM", duration: "2m 18s",
    thread: [
      { role: "bot", text: "Hi! What are you looking for today?" },
      { role: "user", text: "Do you have wireless headphones?" },
      { role: "bot", text: "Yes! Two great options:\n1. Wireless Earbuds Pro — $79.99\n2. Over-Ear BT Headphones — $129.99" },
      { role: "user", text: "What's the battery life on the earbuds?" },
      { role: "bot", text: "The Earbuds Pro offer 6 hrs + 18 hrs from the case. Want to buy them?" },
    ],
  },
  {
    id: "3", customer: "Priya Sharma", email: "priya.s@email.com",
    firstMessage: "What's the return policy for shoes?",
    messages: 4, products: 0, status: "resolved",
    startedAt: "Feb 26, 2026 · 1:30 PM", duration: "1m 45s",
    thread: [
      { role: "bot", text: "Hi! How can I help?" },
      { role: "user", text: "What's the return policy for shoes?" },
      { role: "bot", text: "We accept returns within 30 days, unworn and in original packaging." },
      { role: "user", text: "Thanks!" },
    ],
  },
  {
    id: "4", customer: "Guest User", email: "—",
    firstMessage: "Show me your best selling products",
    messages: 3, products: 5, status: "pending",
    startedAt: "Feb 26, 2026 · 12:58 PM", duration: "Active",
    thread: [
      { role: "bot", text: "Hi! What are you looking for?" },
      { role: "user", text: "Show me your best selling products" },
      { role: "bot", text: "Top sellers:\n1. Nike Air Max 270 — $120\n2. Classic Denim Jacket — $89\n3. Wireless Earbuds Pro — $79.99\n4. Running Shorts — $35\n5. Yoga Mat Premium — $45" },
    ],
  },
  {
    id: "5", customer: "Alex Rivera", email: "alex.r@email.com",
    firstMessage: "Is the blue hoodie available in XL?",
    messages: 6, products: 1, status: "resolved",
    startedAt: "Feb 26, 2026 · 11:10 AM", duration: "3m 02s",
    thread: [
      { role: "bot", text: "Hi! How can I help?" },
      { role: "user", text: "Is the blue hoodie available in XL?" },
      { role: "bot", text: "Classic Blue Hoodie is available in XL for $65.00. Add to cart?" },
      { role: "user", text: "Can I get it in navy?" },
      { role: "bot", text: "Navy is out of stock, expected back in 2 weeks. Want me to notify you?" },
      { role: "user", text: "Please do, thanks!" },
    ],
  },
  {
    id: "6", customer: "Emma Wilson", email: "emma.w@email.com",
    firstMessage: "Gift ideas under $100 please",
    messages: 7, products: 4, status: "active",
    startedAt: "Feb 26, 2026 · 10:45 AM", duration: "Active",
    thread: [
      { role: "bot", text: "Hi! What are you looking for?" },
      { role: "user", text: "Gift ideas under $100 please" },
      { role: "bot", text: "Great gift ideas under $100:\n1. Wireless Earbuds Pro — $79.99\n2. Yoga Mat Premium — $45\n3. Classic Denim Jacket — $89\n4. Canvas Sneakers — $44" },
      { role: "user", text: "Tell me about the yoga mat" },
      { role: "bot", text: "The Yoga Mat Premium is 6mm thick, non-slip, with a carry strap. Perfect gift for fitness lovers!" },
      { role: "user", text: "Does it come in a gift box?" },
      { role: "bot", text: "Yes! You can add gift wrapping at checkout for $5. Want to add it?" },
      { role: "user", text: "Yes, adding to cart now!" },
    ],
  },
];

const PAGE_SIZE = 4;
const STATUS_TONE = { resolved: "success", pending: "attention", active: "info" };

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "active", content: "Active" },
  { id: "pending", content: "Pending" },
  { id: "resolved", content: "Resolved" },
];

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ role, text }) {
  const isBot = role === "bot";
  return (
    <Box
      padding="300"
      background={isBot ? "bg-surface-active" : "bg-fill-info"}
      borderRadius="200"
      maxWidth="76%"
    >
      <Text
        as="p"
        variant="bodySm"
        tone={isBot ? undefined : "text-inverse"}
      >
        {text}
      </Text>
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChatLogs() {
  const shopify = useAppBridge();

  const [search, setSearch] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedConv, setSelectedConv] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletedIds, setDeletedIds] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Filtering & Search ─────────────────────────────────
  const activeStatus = STATUS_TABS[tabIndex].id;

  const filtered = useMemo(() => {
    return CONVERSATIONS.filter((c) => {
      if (deletedIds.includes(c.id)) return false;
      const matchStatus = activeStatus === "all" || c.status === activeStatus;
      const matchSearch =
        !search ||
        c.customer.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.firstMessage.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [search, activeStatus, deletedIds]);

  // ── Pagination ─────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  // Reset to page 1 when filters change
  const handleSearchChange = useCallback((val) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleTabChange = useCallback((i) => {
    setTabIndex(i);
    setPage(1);
  }, []);

  // ── IndexTable selection ───────────────────────────────
  const resourceName = { singular: "conversation", plural: "conversations" };
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(paginated);

  // ── Actions ────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    setDeletedIds((prev) => [...prev, ...selectedResources]);
    clearSelection();
    shopify.toast.show(`${selectedResources.length} conversation(s) deleted`);
    setPage(1);
  }, [selectedResources, clearSelection, shopify]);

  const handleExport = useCallback(() => {
    setExportLoading(true);
    setTimeout(() => {
      setExportLoading(false);
      shopify.toast.show("Export ready — check your downloads");
    }, 1500);
  }, [shopify]);

  const openConv = useCallback((conv) => {
    setSelectedConv(conv);
    setModalOpen(true);
  }, []);

  // ── KPIs from undeleted data ───────────────────────────
  const live = useMemo(
    () => CONVERSATIONS.filter((c) => !deletedIds.includes(c.id)),
    [deletedIds],
  );
  const kpi = useMemo(() => ({
    total: live.length,
    resolved: live.filter((c) => c.status === "resolved").length,
    pending: live.filter((c) => c.status === "pending").length,
    avgMsgs: live.length ? (live.reduce((s, c) => s + c.messages, 0) / live.length).toFixed(1) : 0,
  }), [live]);

  // ── Row markup ─────────────────────────────────────────
  const rowMarkup = paginated.map((conv, index) => (
    <IndexTable.Row
      id={conv.id}
      key={conv.id}
      selected={selectedResources.includes(conv.id)}
      position={index}
      onClick={() => openConv(conv)}
    >
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Avatar customer name={conv.customer} size="sm" />
          <BlockStack gap="050">
            <Text as="p" variant="bodyMd" fontWeight="semibold">{conv.customer}</Text>
            <Text as="p" variant="bodySm" tone="subdued">{conv.email}</Text>
          </BlockStack>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" variant="bodySm" tone="subdued">
          {conv.firstMessage.length > 45 ? conv.firstMessage.slice(0, 45) + "…" : conv.firstMessage}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="150">
          <Badge>{conv.messages} msgs</Badge>
          {conv.products > 0 && <Badge tone="info">{conv.products} products</Badge>}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE[conv.status]}>{conv.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" variant="bodySm" tone="subdued">{conv.duration}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" variant="bodySm" tone="subdued">{conv.startedAt}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page>
      <TitleBar title="Chat Logs">
        <button loading={exportLoading} onClick={handleExport}>
          Export CSV
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {/* ── KPI Row — updates as you delete conversations ── */}
        <Layout>
          {[
            { label: "Total Conversations", value: kpi.total, tone: undefined },
            { label: "Resolved", value: kpi.resolved, tone: "success" },
            { label: "Pending", value: kpi.pending, tone: "attention" },
            { label: "Avg. Messages", value: kpi.avgMsgs, tone: undefined },
          ].map(({ label, value, tone }) => (
            <Layout.Section key={label} variant="oneQuarter">
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
                  <InlineStack blockAlign="center" gap="200">
                    <Text as="p" variant="heading2xl" fontWeight="bold">{value}</Text>
                    {tone && <Badge tone={tone}>{label.toLowerCase()}</Badge>}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>

        {/* ── Bulk action banner ──────────────────────────── */}
        {selectedResources.length > 0 && (
          <Banner tone="warning" title={`${selectedResources.length} conversation(s) selected`}>
            <InlineStack gap="200">
              <Button tone="critical" onClick={handleDelete}>Delete Selected</Button>
              <Button onClick={clearSelection}>Clear Selection</Button>
            </InlineStack>
          </Banner>
        )}

        {/* ── Table card with Tabs + Search ──────────────── */}
        <Card padding="0">
          <Tabs tabs={STATUS_TABS} selected={tabIndex} onSelect={handleTabChange}>
            {/* Toolbar */}
            <Box padding="400">
              <InlineStack gap="300" blockAlign="end">
                <Box minWidth="300px">
                  <TextField
                    label="Search"
                    labelHidden
                    placeholder="Search customer, email, or message…"
                    value={search}
                    onChange={handleSearchChange}
                    clearButton
                    onClearButtonClick={() => handleSearchChange("")}
                    autoComplete="off"
                  />
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </Text>
              </InlineStack>
            </Box>

            <Divider />

            {/* Table */}
            {filtered.length === 0 ? (
              <Box padding="600">
                <EmptyState
                  heading="No conversations found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <Text as="p" variant="bodyMd">
                    {search ? "Try a different search term." : "No conversations with this status yet."}
                  </Text>
                </EmptyState>
              </Box>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={paginated.length}
                selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Customer" },
                  { title: "First Message" },
                  { title: "Activity" },
                  { title: "Status" },
                  { title: "Duration" },
                  { title: "Started" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <>
                <Divider />
                <Box padding="400">
                  <InlineStack align="center" gap="300" blockAlign="center">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Page {currentPage} of {totalPages} · {filtered.length} total
                    </Text>
                    <Pagination
                      hasPrevious={currentPage > 1}
                      onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                      hasNext={currentPage < totalPages}
                      onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                    />
                  </InlineStack>
                </Box>
              </>
            )}
          </Tabs>
        </Card>
      </BlockStack>

      {/* ── Conversation Detail Modal ─────────────────────── */}
      {selectedConv && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Conversation — ${selectedConv.customer}`}
          secondaryActions={[{ content: "Close", onAction: () => setModalOpen(false) }]}
          primaryAction={{
            content: "Delete",
            destructive: true,
            onAction: () => {
              setDeletedIds((prev) => [...prev, selectedConv.id]);
              setModalOpen(false);
              shopify.toast.show("Conversation deleted");
            },
          }}
        >
          <Modal.Section>
            <BlockStack gap="300">
              {/* Meta */}
              <InlineStack gap="300" wrap>
                <Badge tone={STATUS_TONE[selectedConv.status]}>{selectedConv.status}</Badge>
                <Text as="span" variant="bodySm" tone="subdued">{selectedConv.startedAt}</Text>
                <Text as="span" variant="bodySm" tone="subdued">{selectedConv.messages} messages</Text>
                <Text as="span" variant="bodySm" tone="subdued">{selectedConv.duration}</Text>
                {selectedConv.products > 0 && (
                  <Badge tone="info">{selectedConv.products} products shown</Badge>
                )}
              </InlineStack>
              <Divider />

              {/* Thread */}
              <BlockStack gap="200">
                {selectedConv.thread.map((msg, i) => (
                  <InlineStack
                    key={i}
                    align={msg.role === "user" ? "end" : "start"}
                  >
                    {msg.role === "bot" && (
                      <Box paddingInlineEnd="150">
                        <Avatar name="Bot" initials="B" size="xs" />
                      </Box>
                    )}
                    <ChatBubble role={msg.role} text={msg.text} />
                    {msg.role === "user" && (
                      <Box paddingInlineStart="150">
                        <Avatar customer name={selectedConv.customer} size="xs" />
                      </Box>
                    )}
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
