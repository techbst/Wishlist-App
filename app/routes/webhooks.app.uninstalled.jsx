import { authenticate } from "../shopify.server";
import db from "../db.server";
import { claimWebhook } from "../services/webhook.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  if (!(await claimWebhook(request, shop, topic))) return new Response();

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }
  await db.shop.deleteMany({ where: { shopDomain: shop } });
  await db.wishlistEvent.deleteMany({ where: { shop } });

  return new Response();
};
