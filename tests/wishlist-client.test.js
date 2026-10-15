import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../extensions/wishlist-theme/assets/wishlist.js', import.meta.url), 'utf8');
const item = (productId, variantId) => ({ productId, variantId, productTitle: `Product ${productId}` });
function client() {
  const stored = new Map();
  const requests = [];
  let ok = true;
  let cartOk = true;
  const storage = { getItem: (key) => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const window = { Shopify: { shop: 'one.myshopify.com' } };
  const document = { readyState: 'loading', addEventListener() {}, dispatchEvent() {}, querySelectorAll: () => [] };
  const context = vm.createContext({ window, document, location: { hostname: 'one.example' }, localStorage: storage, sessionStorage: storage, crypto: { randomUUID: () => 'session' }, CustomEvent: class {}, fetch: async (url, options) => {
    requests.push({ url, payload: options?.body && JSON.parse(options.body) });
    return { ok: url.endsWith('cart/add.js') ? cartOk : ok, json: async () => ({ description: 'Sold out', item_count: 1 }) };
  } });
  vm.runInContext(source.replace('  if (document.readyState', '  window.client = { mergeServerItems, readSaved, writeSaved, getVariantId, removeSavedItem, addSavedItemToCart, setConfig: (config) => { activeConfig = config; } };\n  if (document.readyState'), context);
  return { ...window.client, storage, requests, fail: () => { ok = false; }, failCart: () => { cartOk = false; } };
}

test('cards use their own variant, never the main product form variant', () => {
  const c = client();
  assert.equal(c.getVariantId({ matches: () => false, dataset: { variantId: '222' } }), '222');
  assert.equal(c.getVariantId({ matches: () => true, closest: () => ({ querySelector: () => ({ value: '333' }) }), dataset: { variantId: '111' } }), '333');
});

test('customer changes and store changes do not reuse another wishlist', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [item('10', '20')] });
  assert.equal(Object.keys(c.readSaved()).length, 1);
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '2', items: [] });
  assert.equal(Object.keys(c.readSaved()).length, 0);
  await c.mergeServerItems({ shop: 'two.myshopify.com', items: [] });
  assert.equal(Object.keys(c.readSaved()).length, 0);
  assert.equal(c.requests.length, 0);
});

test('server removal wins over a stale customer cache', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [item('10', '20')] });
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [] });
  assert.equal(Object.keys(c.readSaved()).length, 0);
  assert.equal(c.requests.length, 0, 'must not send the deleted cached item back to the server');
});

test('unowned legacy saves are not imported into any customer account', async () => {
  const c = client();
  c.storage.setItem('wishlist_app:v1:one.myshopify.com', JSON.stringify({ old: item('10', '20') }));
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [] });
  assert.equal(Object.keys(c.readSaved()).length, 0);
  assert.equal(c.requests.length, 0);
});

test('successful guest merge is consumed once and never copied to the next account', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', items: [] });
  c.writeSaved({ guest: item('10', '20') });
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [] });
  assert.equal(Object.keys(c.readSaved()).length, 1);
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '2', items: [] });
  assert.equal(Object.keys(c.readSaved()).length, 0);
  assert.equal(c.requests.length, 1);
});

test('failed remove preserves the saved item and reports a retryable error', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [item('10', '20')] });
  c.fail();
  await assert.rejects(c.removeSavedItem(item('10', '20')), /Could not remove/);
  assert.equal(Object.keys(c.readSaved()).length, 1);
});

test('removal normalizes numeric and GID IDs and keeps other items intact', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [item('10', '20'), item('11', '21')] });
  await c.removeSavedItem(item('gid://shopify/Product/10', 'gid://shopify/ProductVariant/20'));
  assert.deepEqual(Object.keys(c.readSaved()), ['gid://shopify/ProductVariant/21']);
});

test('rejected cart requests keep the wishlist item and never send remove', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [item('10', '20')] });
  c.setConfig({ keepInWishlistAfterCart: false });
  c.failCart();
  await assert.rejects(c.addSavedItemToCart(item('10', '20')), /Sold out/);
  assert.equal(Object.keys(c.readSaved()).length, 1);
  assert.equal(c.requests.some((request) => request.payload?.action === 'remove'), false);
});

test('successful add-to-cart removes only when keep-in-wishlist is disabled', async () => {
  const c = client();
  await c.mergeServerItems({ shop: 'one.myshopify.com', customerId: '1', items: [item('10', '20')] });
  c.setConfig({ keepInWishlistAfterCart: true });
  assert.equal(await c.addSavedItemToCart(item('10', '20')), 'Added to cart');
  assert.equal(Object.keys(c.readSaved()).length, 1);
  c.setConfig({ keepInWishlistAfterCart: false });
  assert.equal(await c.addSavedItemToCart(item('10', '20')), 'Added to cart');
  assert.equal(Object.keys(c.readSaved()).length, 0);
  assert.equal(c.requests.find((request) => request.url.endsWith('cart/add.js')).payload.items[0].id, '20');
});
