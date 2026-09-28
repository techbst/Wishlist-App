import { authenticate } from "../shopify.server";
import db from "../db.server";
import { claimWebhook } from "../services/webhook.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  if (!(await claimWebhook(request, shop, topic))) return new Response();
  const current = payload.current;

  if (session) {
    await db.session.update({
      where: {
        id: session.id,
      },
      data: {
        scope: current.toString(),
      },
    });
  }

  return new Response();
};
