import { authenticate } from "../shopify.server";
import db from "../db.server";
import { addCustomerItem, canonicalItem, clearCustomerWishlist, createWishlistShare, getCustomerWishlist, getLoggedInCustomerId, getProxyShop, recordAnalytics, removeCustomerItem } from "../services/wishlist.server";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const defaults = { enabled: true, buttonLabel: "Save to wishlist", accentColor: "#FF5C01", textColor: "#202223", iconColor: "#FF5C01", toastMessage: "Added to your wishlist", productButtonDisplay: "both", zIndex: 20, showOnProductPages: true, showOnCollectionPages: true, guestWishlists: true, customerWishlists: true, showOnProductCards: true, iconStyle: "heart", cardStyle: "floating", productButtonPosition: "product-info", showWishlistLink: false, wishlistSharing: true, pageHeading: "My wishlist", emptyMessage: "Your wishlist is empty.", keepInWishlistAfterCart: true, customization: "{}" };
const allowedEvents = new Set(["wishlist_add", "wishlist_remove", "wishlist_view", "wishlist_share", "wishlist_move_to_cart", "wishlist_cart_success", "wishlist_login", "wishlist_merge", "wishlist_product_unavailable"]);
const requestWindows = new Map();

export const loader = async ({ request }) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = getProxyShop(request, session);
  const record = shop ? await db.wishlistSettings.findUnique({ where: { shop } }) : null;
  const settings = record ? { ...record, customization: safeCustomization(record.customization) } : defaults;
  if (url.searchParams.get("format") === "page") return wishlistPageResponse(settings);
  const customerId = getLoggedInCustomerId(request);
  const wishlist = shop && customerId && settings?.customerWishlists !== false ? await getCustomerWishlist(shop, customerId) : null;
  return new Response(JSON.stringify({ ...(settings || defaults), shop, customerId, items: wishlist?.items || [] }), { headers });
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  const shop = getProxyShop(request, session);
  if (!shop) return json({ error: "shop is required" }, 400);
  const settings = await db.wishlistSettings.findUnique({ where: { shop } });
  const rateKey = `${shop}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "proxy"}`;
  const now = Date.now();
  const window = requestWindows.get(rateKey);
  if (!window || now - window.startedAt > 60_000) requestWindows.set(rateKey, { startedAt: now, count: 1 });
  else if (++window.count > 180) return json({ error: "Too many requests" }, 429);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "Invalid payload" }, 400);
  const customerId = getLoggedInCustomerId(request);
  const actionName = payload.action || (payload.eventType === "remove" ? "remove" : "add");
  if (actionName === "add" && customerId && settings?.customerWishlists === false) return json({ error: "Customer wishlists are disabled" }, 403);
  if (actionName === "add" && !customerId && settings?.guestWishlists === false) return json({ error: "Guest wishlists are disabled" }, 403);
  if (actionName === "share" && settings?.wishlistSharing === false) return json({ error: "Wishlist sharing is disabled" }, 403);
  if (actionName === "analytics" && !allowedEvents.has(payload.eventType)) return json({ error: "Unsupported event" }, 400);
  if (payload.eventType && !allowedEvents.has(payload.eventType)) return json({ error: "Unsupported event" }, 400);
  const item = canonicalItem(payload);
  if (["add", "remove"].includes(actionName) && !item) return json({ error: "productId is required" }, 400);
  if (actionName === "add" && customerId) {
    if (!(await catalogItemExists(admin, item))) return json({ error: "Product or variant is no longer available" }, 422);
    await addCustomerItem(shop, customerId, item);
  }
  if (actionName === "remove" && customerId) await removeCustomerItem(shop, customerId, item.variantKey);
  if (actionName === "clear" && customerId) await clearCustomerWishlist(shop, customerId);
  if (actionName === "share" && customerId) {
    const share = await createWishlistShare(shop, customerId, payload.expiresAt ? new Date(payload.expiresAt) : null);
    await recordAnalytics(shop, { eventType: "wishlist_share", customerId, sessionId: payload.sessionKey });
    return json({ ok: true, shareToken: share?.token || null });
  }
  if (actionName === "analytics" || ["add", "remove"].includes(actionName)) await recordAnalytics(shop, { ...payload, customerId, sessionId: payload.sessionKey, eventType: payload.eventType || `wishlist_${actionName}` });
  if (["add", "remove"].includes(actionName)) await db.wishlistEvent.create({ data: { shop, eventType: actionName === "remove" ? "remove" : "save", productId: item.productId, productTitle: item.productTitle, productHandle: item.productHandle, sessionKey: String(payload.sessionKey || "").slice(0, 255), customerId } });
  return json({ ok: true });
};

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers }); }

async function catalogItemExists(admin, item) {
  if (!admin) return false;
  try {
    const productResponse = await admin.graphql(`query ValidateProduct($id: ID!) { product(id: $id) { id } }`, { variables: { id: item.productId } });
    const product = (await productResponse.json()).data?.product;
    if (!product) return false;
    if (!item.variantId) return true;
    const variantResponse = await admin.graphql(`query ValidateVariant($id: ID!) { node(id: $id) { ... on ProductVariant { id product { id } } } }`, { variables: { id: item.variantId } });
    const variant = (await variantResponse.json()).data?.node;
    return Boolean(variant?.id && variant.product?.id === product.id);
  } catch {
    return false;
  }
}

function safeCustomization(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }

function wishlistPageResponse(config) {
  const pageSettings = config.customization?.wishlistPage || {};
  const accentColor = safeColor(pageSettings.accentColor || config.accentColor, "#398b69");
  const textColor = safeColor(pageSettings.textColor || config.textColor, "#20352b");
  const pageHeading = escapeHtml(String(pageSettings.title || config.pageHeading || defaults.pageHeading).slice(0, 80));
  // Both the app-proxy page and theme block use the same state/cart renderer.
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageHeading}</title><link rel="stylesheet" href="/apps/wishlist/assets/styles"></head><body><main class="wlapp-themed-page" data-wishlist-page><header class="wlapp-themed-page__header"><div><h1>${pageHeading}</h1><p data-wlapp-page-summary role="status">Loading your saved items…</p></div><div><button type="button" data-wlapp-share>Share wishlist</button> <button type="button" data-wlapp-clear>Clear wishlist</button> <a href="/">Continue shopping</a></div></header><p role="status" data-wlapp-page-status></p><div class="wlapp-themed-grid" data-wlapp-page-grid></div><noscript>Please enable JavaScript to view your wishlist.</noscript></main><script src="/apps/wishlist/assets/script" defer></script></body></html>`;
  return new Response(html.replace('<main class=', `<main style="--wlapp-page-accent:${accentColor};--wlapp-page-text:${textColor}" class=`), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}
