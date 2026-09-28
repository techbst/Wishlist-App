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
  return new Response(JSON.stringify({ ...(settings || defaults), customerId, items: wishlist?.items || [] }), { headers });
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
  if (actionName === "analytics" || ["add", "remove"].includes(actionName)) await recordAnalytics(shop, { ...payload, eventType: payload.eventType || `wishlist_${actionName}` });
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
  const emptyMessage = escapeHtml(String(pageSettings.emptyDescription || config.emptyMessage || defaults.emptyMessage).slice(0, 160));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>My wishlist</title><style>body{margin:0;background:#f7f8f6;color:${textColor};font:16px system-ui,sans-serif}.wlapp-page{max-width:1120px;margin:0 auto;padding:56px 22px}.wlapp-page h1{font-size:42px;margin:0 0 8px}.wlapp-page p{color:#66756d}.wlapp-page-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px}.wlapp-page button{border:1px solid ${accentColor};border-radius:999px;padding:10px 16px;background:#fff;color:${textColor};cursor:pointer}.wlapp-page button.primary{background:${accentColor};color:#fff}.wlapp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;margin-top:32px}.wlapp-item{background:#fff;border:1px solid #e1e8e2;border-radius:18px;overflow:hidden}.wlapp-item img{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:#eef2ee}.wlapp-item-body{padding:16px}.wlapp-item h2{font-size:16px;margin:0 0 8px}.wlapp-item a{color:${textColor};text-decoration:none}.wlapp-item-actions{display:flex;gap:8px;flex-wrap:wrap}.wlapp-empty{padding:42px 0}</style></head><body><main class="wlapp-page"><div class="wlapp-page-toolbar"><div><p>YOUR SAVED EDITS</p><h1>My wishlist</h1><p data-wlapp-summary>Loading your saved items…</p></div><button class="primary" data-wlapp-share>Share wishlist</button></div><div id="wlapp-grid" class="wlapp-grid"></div></main><script>(async()=>{const endpoint='${"/apps/wishlist?format=json"}',key='wishlist_app:v1',grid=document.querySelector('#wlapp-grid'),summary=document.querySelector('[data-wlapp-summary]');let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{};const config=await fetch(endpoint,{credentials:'same-origin'}).then(r=>r.ok?r.json():{}).catch(()=>({}));fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analytics',eventType:'wishlist_view',sessionKey:localStorage.getItem('wishlist_app:session')||null})}).catch(()=>{});for(const item of (config.items||[])){const id=item.variantId||item.productId;saved[id]={...item,title:item.productTitle,handle:item.productHandle}}localStorage.setItem(key,JSON.stringify(saved));const render=()=>{grid.innerHTML='';const entries=Object.entries(saved);summary.textContent=entries.length+' saved item'+(entries.length===1?'':'s');if(!entries.length){grid.innerHTML='<p class="wlapp-empty">Your wishlist is empty.</p>';return}for(const [id,item] of entries){const card=document.createElement('article');card.className='wlapp-item';const link=document.createElement('a');link.href='/products/'+encodeURIComponent(item.handle||'');const image=document.createElement('img');image.src=item.productImage||'';image.alt=item.title||'';const body=document.createElement('div');body.className='wlapp-item-body';const title=document.createElement('h2');title.textContent=item.title||'Saved item';const actions=document.createElement('div');actions.className='wlapp-item-actions';const cart=document.createElement('button');cart.className='primary';cart.textContent='Add to cart';cart.onclick=async()=>{cart.disabled=true;try{const response=await fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{id:Number(String(item.variantId||'').split('/').pop()),quantity:1}]})});if(!response.ok)throw new Error();fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analytics',eventType:'wishlist_move_to_cart',productId:item.productId,variantId:item.variantId,sessionKey:localStorage.getItem('wishlist_app:session')||null})});document.dispatchEvent(new CustomEvent('cart:refresh'));cart.textContent='Added'}catch{cart.textContent='Unavailable';setTimeout(()=>cart.textContent='Add to cart',1600)}cart.disabled=false};const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>{delete saved[id];localStorage.setItem(key,JSON.stringify(saved));fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',productId:item.productId,variantId:item.variantId})});render()};actions.append(cart,remove);link.append(image);body.append(title,actions);card.append(link,body);grid.append(card)}};document.querySelector('[data-wlapp-share]').onclick=async()=>{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'share'})}).then(r=>r.json()).catch(()=>({}));if(response.shareToken){const url=location.origin+'/apps/wishlist/share/'+response.shareToken;try{await navigator.clipboard.writeText(url)}catch{}alert('Wishlist link copied')}else alert('Sign in to share your wishlist')};render()})()</script></body></html>`;
  const cartIntegration = "fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analytics',eventType:'wishlist_move_to_cart',productId:item.productId,variantId:item.variantId})});fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analytics',eventType:'wishlist_cart_success',productId:item.productId,variantId:item.variantId})});window.dispatchEvent(new CustomEvent('cart:updated',{detail:{source:'wishlist'}}));document.dispatchEvent(new CustomEvent('cart:refresh'));";
  const scopedHtml = html.replace("key='wishlist_app:v1'", "key='wishlist_app:v1:'+(window.Shopify?.shop||location.hostname)").replace("My wishlist</title>", `${pageHeading}</title>`).replace(">My wishlist</h1>", `>${pageHeading}</h1>`).replace("Your wishlist is empty.", emptyMessage).replace("title.textContent=item.title||'Saved item'", "title.textContent=(item.title||'Saved item')+(item.variantTitle?' · '+item.variantTitle:'')+(item.price?' · '+item.price:'')").replace("cart.textContent='Add to cart'", "cart.textContent=item.available===false||!item.variantId?'Unavailable':'Add to cart';if(cart.textContent==='Unavailable')cart.disabled=true").replace("cart.textContent='Added'", "cart.textContent='Added';if(config.keepInWishlistAfterCart===false){delete saved[id];localStorage.setItem(key,JSON.stringify(saved));render()}").replace('<button class="primary" data-wlapp-share>Share wishlist</button>', '<div><button class="primary" data-wlapp-share>Share wishlist</button> <button data-wlapp-clear>Clear wishlist</button> <button onclick="location.href=\'/\'">Continue shopping</button></div>').replace("grid.innerHTML='<p class=\"wlapp-empty\">Your wishlist is empty.</p>'", `grid.innerHTML='<p class="wlapp-empty">${emptyMessage}<br><button onclick="location.href=\\'/\\'">Continue shopping</button></p>'`).replace(";render()})()", ";document.querySelector('[data-wlapp-clear]').onclick=()=>{saved={};localStorage.setItem(key,JSON.stringify(saved));fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clear'})});render()};render()})()");
  return new Response(scopedHtml.replace("document.dispatchEvent(new CustomEvent('cart:refresh'));", cartIntegration), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}
