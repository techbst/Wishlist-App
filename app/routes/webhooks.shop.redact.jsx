import { authenticate } from "../shopify.server";
import db from "../db.server";
import { claimWebhook } from "../services/webhook.server";

export const action = async ({ request }) => {
  const { shop } = await authenticate.webhook(request);
  if (!(await claimWebhook(request, shop, "shop/redact"))) return new Response();
  await db.shop.deleteMany({ where: { shopDomain: shop } });
  await db.session.deleteMany({ where: { shop } });
  await db.wishlistEvent.deleteMany({ where: { shop } });
  return new Response();
};
