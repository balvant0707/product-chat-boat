import { useState, useMemo, useCallback } from "react";
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
  TextField,
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
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

const PAGE_SIZE = 10;
const STATUS_TONE = { resolved: "success", pending: "attention", active: "info" };

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "active", content: "Active" },
  { id: "pending", content: "Pending" },
  { id: "resolved", content: "Resolved" },
];

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {
    conversations: [],
  };
};

function ChatBubble({ role, text }) {
  const isBot = role === "bot";
  return (
    <Box
      padding="300"
      background={isBot ? "bg-surface-active" : "bg-fill-info"}
      borderRadius="200"
      maxWidth="76%"
    >
      <Text as="p" variant="bodySm" tone={isBot ? undefined : "text-inverse"}>
        {text}
      </Text>
    </Box>
  );
}

function normalizeConversation(item) {
  const conversation = item || {};
  const fallbackId = `${String(conversation.customer || "guest")}-${String(
    conversation.startedAt || "unknown",
  )}-${String(conversation.firstMessage || "")}`;
  return {
    id: String(conversation.id || fallbackId),
    customer: String(conversation.customer || "Guest"),
    email: String(conversation.email || "-"),
    firstMessage: String(conversation.firstMessage || ""),
    messages: Number.isFinite(conversation.messages) ? conversation.messages : 0,
    products: Number.isFinite(conversation.products) ? conversation.products : 0,
    status: String(conversation.status || "pending").toLowerCase(),
    startedAt: String(conversation.startedAt || "-"),
    duration: String(conversation.duration || "-"),
    thread: Array.isArray(conversation.thread) ? conversation.thread : [],
  };
}

export default function ChatLogs() {
  const shopify = useAppBridge();
  const { conversations: initialConversations } = useLoaderData();

  const [conversations, setConversations] = useState(
    Array.isArray(initialConversations)
      ? initialConversations.map(normalizeConversation)
      : [],
  );
  const [search, setSearch] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedConv, setSelectedConv] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const activeStatus = STATUS_TABS[tabIndex].id;

  const filtered = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchStatus =
        activeStatus === "all" || conversation.status === activeStatus;
      const matchSearch =
        !search ||
        conversation.customer.toLowerCase().includes(search.toLowerCase()) ||
        conversation.email.toLowerCase().includes(search.toLowerCase()) ||
        conversation.firstMessage.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [conversations, search, activeStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleTabChange = useCallback((index) => {
    setTabIndex(index);
    setPage(1);
  }, []);

  const resourceName = { singular: "conversation", plural: "conversations" };
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(paginated);

  const handleDelete = useCallback(() => {
    if (!selectedResources.length) return;

    setConversations((prev) =>
      prev.filter((conversation) => !selectedResources.includes(conversation.id)),
    );
    clearSelection();
    setPage(1);
    shopify.toast.show(`${selectedResources.length} conversation(s) deleted`);
  }, [selectedResources, clearSelection, shopify]);

  const handleExport = useCallback(() => {
    if (!conversations.length) {
      shopify.toast.show("No conversations to export");
      return;
    }

    setExportLoading(true);
    setTimeout(() => {
      setExportLoading(false);
      shopify.toast.show("Export action completed");
    }, 1000);
  }, [conversations.length, shopify]);

  const openConversation = useCallback((conversation) => {
    setSelectedConv(conversation);
    setModalOpen(true);
  }, []);

  const kpi = useMemo(() => {
    const total = conversations.length;
    const resolved = conversations.filter((c) => c.status === "resolved").length;
    const pending = conversations.filter((c) => c.status === "pending").length;
    const avgMsgs = total
      ? (conversations.reduce((sum, conversation) => sum + conversation.messages, 0) / total).toFixed(1)
      : "0.0";

    return { total, resolved, pending, avgMsgs };
  }, [conversations]);

  const rowMarkup = paginated.map((conversation, index) => (
    <IndexTable.Row
      id={conversation.id}
      key={conversation.id}
      selected={selectedResources.includes(conversation.id)}
      position={index}
      onClick={() => openConversation(conversation)}
    >
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Avatar customer name={conversation.customer} size="sm" />
          <BlockStack gap="050">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {conversation.customer}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {conversation.email}
            </Text>
          </BlockStack>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" variant="bodySm" tone="subdued">
          {conversation.firstMessage.length > 45
            ? `${conversation.firstMessage.slice(0, 45)}...`
            : conversation.firstMessage || "-"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="150">
          <Badge>{conversation.messages} msgs</Badge>
          {conversation.products > 0 ? (
            <Badge tone="info">{conversation.products} products</Badge>
          ) : null}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE[conversation.status] || "new"}>
          {conversation.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" variant="bodySm" tone="subdued">
          {conversation.duration}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="p" variant="bodySm" tone="subdued">
          {conversation.startedAt}
        </Text>
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
        {conversations.length === 0 ? (
          <Banner tone="info" title="No chat logs yet">
            <Text as="p" variant="bodyMd">
              Chat conversations will appear here after storefront users start messaging your bot.
            </Text>
          </Banner>
        ) : null}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {[
            { label: "Total Conversations", value: kpi.total, tone: undefined },
            { label: "Resolved", value: kpi.resolved, tone: "success" },
            { label: "Pending", value: kpi.pending, tone: "attention" },
            { label: "Avg. Messages", value: kpi.avgMsgs, tone: undefined },
          ].map(({ label, value, tone }) => (
            <Card key={label}>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  {label}
                </Text>
                <InlineStack blockAlign="center" gap="200">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {value}
                  </Text>
                  {tone ? <Badge tone={tone}>{label.toLowerCase()}</Badge> : null}
                </InlineStack>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        {selectedResources.length > 0 ? (
          <Banner tone="warning" title={`${selectedResources.length} conversation(s) selected`}>
            <InlineStack gap="200">
              <Button tone="critical" onClick={handleDelete}>
                Delete Selected
              </Button>
              <Button onClick={clearSelection}>Clear Selection</Button>
            </InlineStack>
          </Banner>
        ) : null}

        <Card padding="0">
          <Tabs tabs={STATUS_TABS} selected={tabIndex} onSelect={handleTabChange}>
            <Box padding="400">
              <InlineStack gap="300" blockAlign="end">
                <Box minWidth="300px">
                  <TextField
                    label="Search"
                    labelHidden
                    placeholder="Search customer, email, or message..."
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

            {filtered.length === 0 ? (
              <Box padding="600">
                <EmptyState
                  heading="No conversations found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <Text as="p" variant="bodyMd">
                    {search
                      ? "Try a different search term."
                      : "No conversations with this status yet."}
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

            {totalPages > 1 ? (
              <>
                <Divider />
                <Box padding="400">
                  <InlineStack align="center" gap="300" blockAlign="center">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Page {currentPage} of {totalPages} | {filtered.length} total
                    </Text>
                    <Pagination
                      hasPrevious={currentPage > 1}
                      onPrevious={() => setPage((value) => Math.max(1, value - 1))}
                      hasNext={currentPage < totalPages}
                      onNext={() =>
                        setPage((value) => Math.min(totalPages, value + 1))
                      }
                    />
                  </InlineStack>
                </Box>
              </>
            ) : null}
          </Tabs>
        </Card>
      </BlockStack>

      {selectedConv ? (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Conversation - ${selectedConv.customer}`}
          secondaryActions={[
            { content: "Close", onAction: () => setModalOpen(false) },
          ]}
          primaryAction={{
            content: "Delete",
            destructive: true,
            onAction: () => {
              setConversations((prev) =>
                prev.filter((conversation) => conversation.id !== selectedConv.id),
              );
              setModalOpen(false);
              shopify.toast.show("Conversation deleted");
            },
          }}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <InlineStack gap="300" wrap>
                <Badge tone={STATUS_TONE[selectedConv.status] || "new"}>
                  {selectedConv.status}
                </Badge>
                <Text as="span" variant="bodySm" tone="subdued">
                  {selectedConv.startedAt}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {selectedConv.messages} messages
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {selectedConv.duration}
                </Text>
                {selectedConv.products > 0 ? (
                  <Badge tone="info">{selectedConv.products} products shown</Badge>
                ) : null}
              </InlineStack>

              <Divider />

              {selectedConv.thread.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No message thread available for this conversation.
                </Text>
              ) : (
                <BlockStack gap="200">
                  {selectedConv.thread.map((message, index) => (
                    <InlineStack
                      key={`${selectedConv.id}-${index}`}
                      align={message.role === "user" ? "end" : "start"}
                    >
                      {message.role === "bot" ? (
                        <Box paddingInlineEnd="150">
                          <Avatar name="Bot" initials="B" size="xs" />
                        </Box>
                      ) : null}
                      <ChatBubble role={message.role} text={message.text} />
                      {message.role === "user" ? (
                        <Box paddingInlineStart="150">
                          <Avatar customer name={selectedConv.customer} size="xs" />
                        </Box>
                      ) : null}
                    </InlineStack>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      ) : null}
    </Page>
  );
}
