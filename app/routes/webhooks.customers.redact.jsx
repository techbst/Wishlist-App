import { authenticate } from "../shopify.server";
import db from "../db.server";
import { claimWebhook } from "../services/webhook.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  if (!(await claimWebhook(request, shop, "customers/redact"))) return new Response();
  const customerId = String(payload.customer?.id || payload.customer?.id || "");
  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (shopRecord && customerId) await db.customerWishlist.deleteMany({ where: { shopId: shopRecord.id, customerId } });
  await db.wishlistEvent.deleteMany({ where: { shop, customerId } });
  return new Response();
};
