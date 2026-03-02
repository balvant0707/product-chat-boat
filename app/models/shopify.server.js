/**
 * Shopify Admin API helpers for the chatbot
 * All functions require shopDomain to look up the stored access token.
 */
import db from "../db.server.js";

async function getShopToken(shopDomain) {
  const session = await db.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    orderBy: [{ expires: "desc" }],
  });
  if (session?.accessToken) return session.accessToken;
  const shop = await db.shop.findUnique({ where: { shop: shopDomain } });
  return shop?.accessToken || null;
}

async function adminGQL(shopDomain, accessToken, query, variables = {}) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (!res.ok) throw new Error(`Shopify Admin API ${res.status}`);
  return res.json();
}

// ─── Product Search ───────────────────────────────────────────────────────────

export async function searchProducts(
  shopDomain,
  {
    searchQuery = "",
    priceMax = null,
    color = null,
    inStock = false,
    limit = 5,
  } = {},
) {
  const token = await getShopToken(shopDomain);
  if (!token) return [];

  let q = searchQuery || "*";
  if (priceMax) q += ` price:<=${priceMax}`;
  if (inStock) q += ` available_for_sale:true`;

  const gql = `
    query SearchProducts($query: String!, $limit: Int!) {
      products(first: $limit, query: $query) {
        edges {
          node {
            id title handle tags availableForSale
            priceRange { minVariantPrice { amount currencyCode } }
            compareAtPriceRange { minVariantPrice { amount currencyCode } }
            variants(first: 1) {
              edges { node { id availableForSale selectedOptions { name value } } }
            }
            images(first: 1) {
              edges { node { url altText } }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await adminGQL(shopDomain, token, gql, { query: q, limit });
    let products = (result?.data?.products?.edges || []).map(({ node }) => ({
      id: node.id.replace("gid://shopify/Product/", ""),
      title: node.title,
      handle: node.handle,
      tags: node.tags || [],
      available: node.availableForSale,
      price: node.priceRange?.minVariantPrice?.amount || "0",
      currency: node.priceRange?.minVariantPrice?.currencyCode || "INR",
      comparePrice: node.compareAtPriceRange?.minVariantPrice?.amount || null,
      image: node.images?.edges?.[0]?.node?.url || null,
      imageAlt: node.images?.edges?.[0]?.node?.altText || node.title,
      url: `/products/${node.handle}`,
      variantId: node.variants?.edges?.[0]?.node?.id || null,
    }));

    if (color) {
      const colorLower = color.toLowerCase();
      const filtered = products.filter((p) =>
        p.tags.some((t) => t.toLowerCase().includes(colorLower)) ||
        p.title.toLowerCase().includes(colorLower),
      );
      if (filtered.length) products = filtered;
    }

    return products.slice(0, limit);
  } catch (err) {
    console.error("[shopify.server] searchProducts error:", err);
    return [];
  }
}

export async function getCollectionProducts(
  shopDomain,
  collectionHandle,
  limit = 5,
) {
  const token = await getShopToken(shopDomain);
  if (!token) return [];

  const gql = `
    query ($handle: String!, $limit: Int!) {
      collectionByHandle(handle: $handle) {
        title
        products(first: $limit) {
          edges {
            node {
              id title handle availableForSale
              priceRange { minVariantPrice { amount currencyCode } }
              compareAtPriceRange { minVariantPrice { amount currencyCode } }
              images(first: 1) { edges { node { url altText } } }
              variants(first: 1) { edges { node { id } } }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await adminGQL(shopDomain, token, gql, {
      handle: collectionHandle,
      limit,
    });
    const edges =
      result?.data?.collectionByHandle?.products?.edges || [];
    return edges.map(({ node }) => ({
      id: node.id.replace("gid://shopify/Product/", ""),
      title: node.title,
      handle: node.handle,
      available: node.availableForSale,
      price: node.priceRange?.minVariantPrice?.amount || "0",
      currency:
        node.priceRange?.minVariantPrice?.currencyCode || "INR",
      comparePrice:
        node.compareAtPriceRange?.minVariantPrice?.amount || null,
      image: node.images?.edges?.[0]?.node?.url || null,
      imageAlt: node.images?.edges?.[0]?.node?.altText || node.title,
      url: `/products/${node.handle}`,
      variantId: node.variants?.edges?.[0]?.node?.id || null,
    }));
  } catch (err) {
    console.error("[shopify.server] getCollectionProducts error:", err);
    return [];
  }
}

// ─── Order Lookup ─────────────────────────────────────────────────────────────

export async function lookupOrder(
  shopDomain,
  { email, phone, orderName, orderNumber } = {},
) {
  const token = await getShopToken(shopDomain);
  if (!token) return null;

  let q = "";
  if (orderName) q = `name:${orderName}`;
  else if (orderNumber) q = `name:#${orderNumber}`;
  else if (email) q = `email:${email.toLowerCase()}`;
  else if (phone) q = `phone:${phone}`;
  else return null;

  const gql = `
    query ($q: String!) {
      orders(first: 3, query: $q) {
        edges {
          node {
            id name email phone
            displayFinancialStatus displayFulfillmentStatus
            processedAt cancelledAt
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 5) {
              edges { node { title quantity } }
            }
            fulfillments {
              displayStatus
              estimatedDeliveryAt deliveredAt
              trackingInfo { company number url }
            }
            shippingAddress { city province country }
          }
        }
      }
    }
  `;

  try {
    const result = await adminGQL(shopDomain, token, gql, { q });
    const edges = result?.data?.orders?.edges || [];
    if (!edges.length) return null;

    const node = edges[0].node;
    const fulfillment = node.fulfillments?.[0] || null;
    const tracking = fulfillment?.trackingInfo?.[0] || null;

    // Determine human-readable stage
    let stage = "Processing";
    let stageClass = "pcb-stage--processing";
    if (node.cancelledAt) {
      stage = "Cancelled";
      stageClass = "pcb-stage--cancelled";
    } else if (fulfillment?.deliveredAt) {
      stage = "Delivered";
      stageClass = "pcb-stage--delivered";
    } else if (fulfillment?.displayStatus === "OUT_FOR_DELIVERY") {
      stage = "Out for Delivery";
      stageClass = "pcb-stage--out-for-delivery";
    } else if (fulfillment?.displayStatus === "IN_TRANSIT") {
      stage = "In Transit";
      stageClass = "pcb-stage--in-transit";
    } else if (
      node.displayFulfillmentStatus === "FULFILLED" ||
      node.displayFulfillmentStatus === "PARTIAL"
    ) {
      stage = "Shipped";
      stageClass = "pcb-stage--shipped";
    }

    return {
      orderName: node.name,
      email: node.email || null,
      phone: node.phone || null,
      financialStatus: node.displayFinancialStatus || "Paid",
      fulfillmentStatus: node.displayFulfillmentStatus || "UNFULFILLED",
      stage,
      stageClass,
      cancelledAt: node.cancelledAt,
      processedAt: node.processedAt,
      total: node.totalPriceSet?.shopMoney?.amount,
      currency: node.totalPriceSet?.shopMoney?.currencyCode || "INR",
      items: (node.lineItems?.edges || []).map((e) => ({
        title: e.node.title,
        quantity: e.node.quantity,
      })),
      trackingNumber: tracking?.number || null,
      trackingCompany: tracking?.company || null,
      trackingUrl: tracking?.url || null,
      estimatedDelivery: fulfillment?.estimatedDeliveryAt || null,
      deliveredAt: fulfillment?.deliveredAt || null,
      shippingCity: node.shippingAddress?.city || null,
    };
  } catch (err) {
    console.error("[shopify.server] lookupOrder error:", err);
    return null;
  }
}

// ─── Discounts & Coupons ──────────────────────────────────────────────────────

export async function getActiveDiscounts(shopDomain) {
  const token = await getShopToken(shopDomain);
  if (!token) return [];

  const gql = `
    {
      codeDiscountNodes(first: 10, query: "status:ACTIVE") {
        edges {
          node {
            codeDiscount {
              ... on DiscountCodeBasic {
                title status
                codes(first: 3) { edges { node { code } } }
                customerGets {
                  value {
                    ... on DiscountAmount { amount { amount currencyCode } }
                    ... on DiscountPercentage { percentage }
                  }
                }
                minimumRequirement {
                  ... on DiscountMinimumSubtotal {
                    greaterThanOrEqualToSubtotal { amount currencyCode }
                  }
                }
                endsAt
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await adminGQL(shopDomain, token, gql, {});
    return (result?.data?.codeDiscountNodes?.edges || [])
      .map(({ node }) => {
        const d = node.codeDiscount;
        if (!d || d.status !== "ACTIVE") return null;
        const codes = (d.codes?.edges || []).map((e) => e.node.code);
        if (!codes.length) return null;
        const val = d.customerGets?.value;
        const minSub =
          d.minimumRequirement?.greaterThanOrEqualToSubtotal;
        const isPercent = Boolean(val?.percentage);
        return {
          title: d.title || "",
          code: codes[0],
          codes,
          isPercent,
          percentage: isPercent
            ? Math.round(val.percentage * 100)
            : null,
          amount: !isPercent ? val?.amount?.amount : null,
          currency: val?.amount?.currencyCode || "INR",
          valueLabel: isPercent
            ? `${Math.round(val.percentage * 100)}% off`
            : `${val?.amount?.currencyCode || "INR"} ${val?.amount?.amount} off`,
          minimumCartValue: minSub?.amount
            ? parseFloat(minSub.amount)
            : null,
          minimumCartFormatted: minSub
            ? `${minSub.currencyCode} ${minSub.amount}`
            : null,
          endsAt: d.endsAt || null,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error("[shopify.server] getActiveDiscounts error:", err);
    return [];
  }
}

export async function validateCoupon(shopDomain, code) {
  const token = await getShopToken(shopDomain);
  if (!token) return { valid: false, reason: "Store not configured" };

  const gql = `
    query ($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title status
            customerGets {
              value {
                ... on DiscountAmount { amount { amount currencyCode } }
                ... on DiscountPercentage { percentage }
              }
            }
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal { amount currencyCode }
              }
            }
            usageLimit asyncUsageCount endsAt
          }
        }
      }
    }
  `;

  try {
    const result = await adminGQL(shopDomain, token, gql, {
      code: code.toUpperCase(),
    });
    const node = result?.data?.codeDiscountNodeByCode;
    if (!node) return { valid: false, reason: "Coupon code not found" };

    const d = node.codeDiscount;
    if (d?.status !== "ACTIVE") {
      return { valid: false, reason: "This coupon is expired or inactive" };
    }

    const val = d.customerGets?.value;
    const minSub = d.minimumRequirement?.greaterThanOrEqualToSubtotal;
    const isPercent = Boolean(val?.percentage);

    return {
      valid: true,
      code: code.toUpperCase(),
      title: d.title,
      isPercent,
      percentage: isPercent ? Math.round(val.percentage * 100) : null,
      amount: !isPercent ? val?.amount?.amount : null,
      currency: val?.amount?.currencyCode || "INR",
      valueLabel: isPercent
        ? `${Math.round(val.percentage * 100)}% off`
        : `${val?.amount?.currencyCode || "INR"} ${val?.amount?.amount} off`,
      minimumCartValue: minSub?.amount ? parseFloat(minSub.amount) : null,
      minimumCartFormatted: minSub
        ? `${minSub.currencyCode} ${minSub.amount}`
        : null,
      usageLimit: d.usageLimit || null,
      usageCount: d.asyncUsageCount || 0,
      endsAt: d.endsAt || null,
    };
  } catch (err) {
    console.error("[shopify.server] validateCoupon error:", err);
    return { valid: false, reason: "Unable to validate coupon right now" };
  }
}

// ─── Shop Policies / Meta ─────────────────────────────────────────────────────

export async function getShopMeta(shopDomain) {
  const token = await getShopToken(shopDomain);
  if (!token) return {};

  const gql = `
    {
      shop {
        name currencyCode
        shippingPolicy { body }
        refundPolicy { body }
      }
    }
  `;

  try {
    const result = await adminGQL(shopDomain, token, gql, {});
    const shop = result?.data?.shop || {};
    return {
      name: shop.name || "",
      currency: shop.currencyCode || "INR",
      shippingPolicy: shop.shippingPolicy?.body || null,
      refundPolicy: shop.refundPolicy?.body || null,
    };
  } catch (err) {
    return {};
  }
}
