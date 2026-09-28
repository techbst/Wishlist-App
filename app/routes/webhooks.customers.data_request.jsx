import { authenticate } from "../shopify.server";
import { claimWebhook } from "../services/webhook.server";

export const action = async ({ request }) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  if (!(await claimWebhook(request, shop, topic || "customers/data_request"))) return new Response();
  console.info("Received customer data request", { shop, customerId: payload.customer?.id, requestId: payload.data_request?.id });
  return new Response();
};
