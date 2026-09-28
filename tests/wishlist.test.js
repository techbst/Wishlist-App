import test from "node:test";
import assert from "node:assert/strict";
import { canonicalItem, getLoggedInCustomerId, getProxyShop } from "../app/services/wishlist.server.js";

test("accepts only Shopify shop domains from signed proxy context", () => {
  const request = new Request("https://storefront.example/apps/wishlist?shop=demo-store.myshopify.com");
  assert.equal(getProxyShop(request), "demo-store.myshopify.com");
  assert.equal(getProxyShop(new Request("https://storefront.example/apps/wishlist?shop=other.example")), null);
});

test("parses only numeric logged-in customer IDs", () => {
  assert.equal(getLoggedInCustomerId(new Request("https://storefront.example/apps/wishlist?logged_in_customer_id=123")), "123");
  assert.equal(getLoggedInCustomerId(new Request("https://storefront.example/apps/wishlist?logged_in_customer_id=customer-123")), null);
});

test("uses the selected variant as the unique wishlist key", () => {
  const item = canonicalItem({ productId: "gid://shopify/Product/10", variantId: "gid://shopify/ProductVariant/20", productTitle: "Jacket", available: false });
  assert.equal(item.variantKey, "gid://shopify/ProductVariant/20");
  assert.equal(item.productId, "gid://shopify/Product/10");
  assert.equal(item.available, false);
});

test("rejects wishlist payloads without a product", () => {
  assert.equal(canonicalItem({ variantId: "20" }), null);
});
