import db from "../db.server";

export async function claimWebhook(request, shop, topic) {
  const id = request.headers.get("x-shopify-webhook-id");
  if (!id) return true;
  try {
    await db.webhookReceipt.create({ data: { id, shop, topic } });
    return true;
  } catch (error) {
    if (error?.code === "P2002") return false;
    throw error;
  }
}
