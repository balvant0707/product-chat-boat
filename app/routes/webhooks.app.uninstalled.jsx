import { authenticate } from "../shopify.server";
import db from "../db.server";
import { markShopUninstalled } from "../models/shop.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Keep uninstall idempotent: deleting unknown sessions is safe.
  await db.session.deleteMany({ where: { shop } });
  await markShopUninstalled(shop);

  return new Response();
};
