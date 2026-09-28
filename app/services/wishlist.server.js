import { randomBytes } from "node:crypto";
import db from "../db.server.js";

const SHOP_PATTERN = /^[a-z0-9][a-z0-9.-]+\.myshopify\.com$/i;

export function getProxyShop(request, session) {
  const shop = session?.shop || new URL(request.url).searchParams.get("shop");
  if (!shop || !SHOP_PATTERN.test(shop)) return null;
  return shop.toLowerCase();
}

export function getLoggedInCustomerId(request) {
  const value = new URL(request.url).searchParams.get("logged_in_customer_id");
  return value && /^\d+$/.test(value) ? value : null;
}

export async function ensureShop(shopDomain) {
  return db.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });
}

export async function getCustomerWishlist(shopDomain, customerId) {
  if (!customerId) return null;
  const shop = await ensureShop(shopDomain);
  return db.customerWishlist.findUnique({
    where: { shopId_customerId: { shopId: shop.id, customerId } },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });
}

export async function addCustomerItem(shopDomain, customerId, item) {
  const shop = await ensureShop(shopDomain);
  const wishlist = await db.customerWishlist.upsert({
    where: { shopId_customerId: { shopId: shop.id, customerId } },
    create: { shopId: shop.id, customerId },
    update: {},
  });
  return db.wishlistItem.upsert({
    where: { wishlistId_variantKey: { wishlistId: wishlist.id, variantKey: item.variantKey } },
    create: { wishlistId: wishlist.id, ...item },
    update: { ...item, addedAt: new Date() },
  });
}

export async function removeCustomerItem(shopDomain, customerId, variantKey) {
  const wishlist = await getCustomerWishlist(shopDomain, customerId);
  if (!wishlist) return;
  await db.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, variantKey } });
}

export async function clearCustomerWishlist(shopDomain, customerId) {
  const wishlist = await getCustomerWishlist(shopDomain, customerId);
  if (!wishlist) return;
  await db.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
}

export async function createWishlistShare(shopDomain, customerId, expiresAt) {
  const wishlist = await getCustomerWishlist(shopDomain, customerId);
  if (!wishlist) return null;
  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const requestedExpiry = expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date() ? expiresAt : defaultExpiry;
  const maximumExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const safeExpiry = requestedExpiry > maximumExpiry ? maximumExpiry : requestedExpiry;
  return db.wishlistShare.create({
    data: { wishlistId: wishlist.id, token: randomBytes(24).toString("base64url"), expiresAt: safeExpiry },
    include: { wishlist: { include: { items: true } } },
  });
}

export async function recordAnalytics(shopDomain, event) {
  const shop = await ensureShop(shopDomain);
  return db.analyticsEvent.create({
    data: {
      shopId: shop.id,
      eventType: String(event.eventType).slice(0, 64),
      customerId: event.customerId || null,
      sessionId: event.sessionId ? String(event.sessionId).slice(0, 255) : null,
      productId: event.productId ? String(event.productId).slice(0, 255) : null,
      variantId: event.variantId ? String(event.variantId).slice(0, 255) : null,
      metadata: event.metadata ? JSON.stringify(event.metadata).slice(0, 4000) : null,
    },
  });
}

export function canonicalItem(payload) {
  const productId = canonicalId(payload.productId, "Product");
  const variantId = payload.variantId ? canonicalId(payload.variantId, "ProductVariant") : null;
  if (!productId) return null;
  return {
    variantKey: variantId || productId,
    productId,
    variantId,
    productHandle: String(payload.productHandle || "").slice(0, 255) || null,
    productTitle: String(payload.productTitle || "").slice(0, 255) || null,
    variantTitle: String(payload.variantTitle || "").slice(0, 255) || null,
    productUrl: String(payload.productUrl || "").slice(0, 500) || null,
    productImage: String(payload.productImage || "").slice(0, 1000) || null,
    price: String(payload.price || "").slice(0, 64) || null,
    compareAtPrice: String(payload.compareAtPrice || "").slice(0, 64) || null,
    available: payload.available !== false,
  };
}

export function canonicalId(value, type) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("gid://shopify/") ? raw : `gid://shopify/${type}/${raw}`;
}
