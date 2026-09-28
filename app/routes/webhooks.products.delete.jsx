import { authenticate } from "../shopify.server";
import db from "../db.server";
import { claimWebhook } from "../services/webhook.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  if (!(await claimWebhook(request, shop, "products/delete"))) return new Response();
  const productId = String(payload.id || "");
  const ids = [productId, `gid://shopify/Product/${productId}`];
  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (shopRecord) {
    await db.wishlistItem.updateMany({ where: { wishlist: { shopId: shopRecord.id }, productId: { in: ids } }, data: { available: false } });
  }
  return new Response();
};
