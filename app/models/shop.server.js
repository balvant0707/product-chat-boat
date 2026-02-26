import db from "../db.server";

export async function upsertInstalledShop(session) {
  if (!session?.shop) return null;

  return db.shop.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      accessToken: session.accessToken ?? null,
      installed: true,
      onboardedAt: new Date(),
      uninstalledAt: null,
    },
    update: {
      accessToken: session.accessToken ?? null,
      installed: true,
      uninstalledAt: null,
    },
  });
}

export async function markShopUninstalled(shopDomain) {
  if (!shopDomain) return null;

  return db.shop.upsert({
    where: { shop: shopDomain },
    create: {
      shop: shopDomain,
      installed: false,
      uninstalledAt: new Date(),
    },
    update: {
      installed: false,
      accessToken: null,
      uninstalledAt: new Date(),
    },
  });
}
