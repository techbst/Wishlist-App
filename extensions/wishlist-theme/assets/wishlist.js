(function () {
  if (window.__wlappLoaded) return;
  window.__wlappLoaded = true;
  let activeConfig = {};
  let stateRevision = 0;
  let activeMutations = 0;
  let customerScope = 'unverified';
  let shopCurrency = window.Shopify?.currency?.active;
  let shopScope = window.Shopify?.shop || location.hostname;
  const pendingItems = new Set();
  const STORAGE_KEY = () => `wishlist_app:v2:${shopScope}:${customerScope}`;
  const heartIcon = '<svg class="wlapp-heart-svg" width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M25 39.7l-.6-.5C11.5 28.7 8 25 8 19c0-5 4-9 9-9 4.1 0 6.4 2.3 8 4.1 1.6-1.8 3.9-4.1 8-4.1 5 0 9 4 9 9 0 6-3.5 9.7-16.4 20.2l-.6.5zM17 12c-3.9 0-7 3.1-7 7 0 5.1 3.2 8.5 15 18.1 11.8-9.6 15-13 15-18.1 0-3.9-3.1-7-7-7-3.5 0-5.4 2.1-6.9 3.8L25 17.1l-1.1-1.3C22.4 14.1 20.5 12 17 12z" fill="currentColor"/></svg>';
  const icons = { heart: [heartIcon, heartIcon], star: ['☆', '★'], bookmark: ['▱', '▰'], spark: ['✧', '✦'] };
  const rootPath=()=>window.Shopify?.routes?.root||'/';
  const endpoint = () => `${rootPath()}apps/wishlist?format=json`;
  const normalizeId = (id, type = 'Product') => { const value = String(id || ''); return value ? (value.startsWith('gid://') ? value : `gid://shopify/${type}/${value}`) : ''; };
  const canonicalKey = (item) => normalizeId(item.variantId, 'ProductVariant') || normalizeId(item.productId);
  const normalizeItems = (items) => Object.fromEntries(Object.values(items || {}).filter((item) => item && item.productId).map((item) => [canonicalKey(item), { ...item, title: item.productTitle || item.title, handle: item.productHandle || item.handle }]));
  const readSaved = () => { try { return normalizeItems(JSON.parse(localStorage.getItem(STORAGE_KEY()) || '{}')); } catch { return {}; } };
  const writeSaved = (items) => {
    localStorage.setItem(STORAGE_KEY(), JSON.stringify(normalizeItems(items)));
    stateRevision++;
    document.dispatchEvent(new CustomEvent('wlapp:change'));
  };
  const sessionKey = () => { const key = `${STORAGE_KEY()}:session`; let value = sessionStorage.getItem(key); if (!value) { value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; sessionStorage.setItem(key, value); } return value; };
  const getVariantId = (root) => {
    if (root.matches('[data-wishlist-product-button], [data-wishlist-embed]')) {
      const section = root.closest('.shopify-section, [data-product-info], product-info');
      return section?.querySelector('form[action*="/cart/add"] [name="id"]')?.value || root.dataset.variantId;
    }
    return root.dataset.variantId;
  };
  const itemKey = (root) => normalizeId(getVariantId(root), 'ProductVariant') || normalizeId(root.dataset.productId);
  const surface = (config, name) => { try { const customization = typeof config.customization === 'string' ? JSON.parse(config.customization || '{}') : (config.customization || {}); return customization[name] || {}; } catch { return {}; } };

  const send = (payload) => fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, sessionKey: sessionKey() }), keepalive: true }).catch(() => ({ ok: false }));
  const productPayload = (root) => ({ productId: normalizeId(root.dataset.productId), variantId: getVariantId(root) ? normalizeId(getVariantId(root), 'ProductVariant') : null, productTitle: root.dataset.productTitle, productHandle: root.dataset.productHandle, productImage: root.dataset.productImage || '', variantTitle: root.dataset.variantTitle, available: root.dataset.available !== 'false' });

  function init(root) {
    if (!root || root.dataset.wlappReady === 'true' || !root.dataset.productId) return;
    const button = root.querySelector('[data-wishlist-button]');
    if (!button) return;
    root.dataset.wlappReady = 'true';
    root.dataset.productId = normalizeId(root.dataset.productId);
    root.style.setProperty('--wlapp-color', root.dataset.color || '#FF5C01');
    root.style.setProperty('--wlapp-text-color', root.dataset.textColor || '#202223');
    root.style.setProperty('--wlapp-icon-color', root.dataset.iconColor || root.dataset.color || '#FF5C01');
    root.style.setProperty('--wlapp-background', root.dataset.background || 'transparent');
    root.style.setProperty('--wlapp-z-index', root.dataset.zIndex || '20');
    if (root.dataset.cardStyle === 'floating') root.classList.add('wlapp-floating');
    if (root.dataset.cardStyle === 'minimal') root.classList.add('wlapp-minimal');
    if (root.dataset.border === 'none') root.classList.add('wlapp-no-border');
    if (root.dataset.position) root.classList.add(`wlapp-position-${root.dataset.position}`);
    if (root.dataset.size) root.classList.add(`wlapp-size-${root.dataset.size}`);
    const label=root.dataset.label||'Save to wishlist';
    const icon=icons[root.dataset.iconStyle]||icons.heart;
    const iconNode=button.querySelector('[data-wishlist-icon]');
    const labelNode=button.querySelector('[data-wishlist-label]');
    button.classList.add(`wlapp-display-${root.dataset.display || 'both'}`);
    const render=(saved, loading=false) => {
      button.disabled = loading;
      button.setAttribute('aria-busy', String(loading));
      button.classList.toggle('wlapp-saved', saved);
      button.classList.toggle('wlapp-loading', loading);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? 'Remove from wishlist' : label);
      if (iconNode) iconNode.innerHTML = saved ? icon[1] : icon[0];
      if (labelNode) labelNode.textContent = saved ? (root.dataset.addedLabel || 'Saved to wishlist') : label;
    };
    const refresh=()=>render(Boolean(readSaved()[itemKey(root)]), pendingItems.has(itemKey(root)));
    document.addEventListener('wlapp:change', refresh);
    refresh();
    document.querySelectorAll('[name="id"], select[name^="options"], [data-option-selector]').forEach((selector) => selector.addEventListener('change', refresh));
    document.addEventListener('variant:change', refresh);
    button.addEventListener('click', async () => {
      const key = itemKey(root);
      if (pendingItems.has(key)) return;
      const wasSaved = Boolean(readSaved()[key]);
      const payload = productPayload(root);
      pendingItems.add(key);
      refresh();
      try {
        const response = await send({ action: wasSaved ? 'remove' : 'add', eventType: wasSaved ? 'wishlist_remove' : 'wishlist_add', ...payload });
        if (!response.ok) throw new Error('Could not save your change. Please try again.');
        const latest = readSaved();
        if (wasSaved) delete latest[key]; else latest[key] = { ...payload, title: root.dataset.productTitle, handle: root.dataset.productHandle };
        writeSaved(latest);
        showToast(wasSaved ? 'Removed from your wishlist' : (root.dataset.toast || 'Added to your wishlist'), root.dataset.zIndex);
      } catch (error) { showToast(error.message, root.dataset.zIndex); }
      finally { pendingItems.delete(key); document.dispatchEvent(new CustomEvent('wlapp:change')); }

    });
  }

  function showToast(message, zIndex) {
    if (!message) return;
    let toast = document.querySelector('[data-wlapp-toast]');
    if (!toast) { toast = document.createElement('div'); toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.dataset.wlappToast = 'true'; toast.className = 'wlapp-toast'; document.body.appendChild(toast); }
    toast.textContent = message;
    toast.style.zIndex = String(zIndex || 20);
    toast.classList.add('is-visible');
    clearTimeout(toast._wlappTimer);
    toast._wlappTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function createCardRoot(product, config, card, handle) {
    const cardConfig = surface(config, 'productCard');
    const root = document.createElement('div');
    root.className = 'wlapp-card-root';
    root.dataset.productId = normalizeId(product.id);
    root.dataset.variantId = product.variants?.find((variant) => variant.available)?.id || product.variants?.[0]?.id || '';
    root.dataset.productHandle=product.handle||handle;
    root.dataset.productTitle=product.title||'';
    root.dataset.productImage=product.featured_image||'',root.dataset.available=product.available
    root.dataset.iconStyle=cardConfig.icon||config.iconStyle||'heart';
    root.dataset.cardStyle=cardConfig.style||config.cardStyle||'floating';
    root.dataset.position=cardConfig.position||'top-right'; root.dataset.size=cardConfig.size||'medium';
    root.dataset.background=cardConfig.background||'#FFFFFF';
    root.dataset.color=cardConfig.accentColor||config.accentColor||'#FF5C01';
    root.dataset.textColor=cardConfig.textColor||config.textColor||'#202223'; root.dataset.iconColor=cardConfig.iconColor||config.iconColor||config.accentColor||'#FF5C01'; root.dataset.display=cardConfig.display||config.productButtonDisplay||'both'; root.dataset.toast=config.toastMessage||''; root.dataset.zIndex=config.zIndex||'20';
    root.dataset.label=cardConfig.label||config.buttonLabel||'Save to wishlist';
    root.innerHTML = `<button type="button" class="wlapp-button" data-wishlist-button><span class="wlapp-icon" data-wishlist-icon aria-hidden="true">${heartIcon}</span><span data-wishlist-label>Save to wishlist</span></button>`;
    if (window.getComputedStyle(card).position === 'static') card.style.position = 'relative';
    card.classList.add('wlapp-card-container');
    card.appendChild(root);
    init(root);
  }

  async function addCardButton(link, config, currentProductHandle = '') {
    const url = new URL(link.href, window.location.origin);
    const match = url.pathname.match(/^\/products\/([^/]+)/);
    if (!match) return;
    // The main product already has its own product-page control. Related and
    // recommended product cards should still be processed normally.
    if (currentProductHandle && match[1] === currentProductHandle) return;
    const card = link.closest('li, article, [data-product-card], .card-wrapper, .product-card, .grid__item');
    if (!card || card.closest('[data-wishlist-page]') || card.querySelector('.wlapp-card-root') || card.dataset.wlappPending === 'true') return;
    card.dataset.wlappPending = 'true';
    try {
      const response = await fetch(`${rootPath()}products/${match[1]}.js`);
      if (response.ok) createCardRoot(await response.json(), config, card, match[1]);
    } catch { card.dataset.wlappPending = '' }
    delete card.dataset.wlappPending;
  }

  function addCardButtons(config) {
    if (config.showOnProductCards === false) return;
    const productControl = document.querySelector('[data-wishlist-product-button], [data-wishlist-embed]');
    const currentProductHandle = productControl?.dataset.productHandle || '';
    document.querySelectorAll('a[href*="/products/"]').forEach((link) => addCardButton(link, config, currentProductHandle));
  }

  function keepSingleProductButton() {
    const controls = document.querySelectorAll('[data-wishlist-product-button], [data-wishlist-embed]');
    const primary = document.querySelector('[data-wishlist-product-button]') || controls[0];
    controls.forEach((control) => {
      if (control !== primary) control.remove();
    });
  }

  function styleProductControl(root, values) {
    const spacing = (value) => Number.isFinite(Number(value)) ? Math.min(64, Math.max(0, Number(value))) : 12;
    const radius = { square: '0px', medium: '10px', full: '999px' }[values.radius] || '10px';
    root.classList.add('wlapp-product-control');
    root.dataset.width = values.width === 'full' ? 'full' : 'auto';
    root.dataset.background = values.background || '#FFFFFF';
    root.dataset.addedLabel = values.addedLabel || 'Saved to wishlist';
    root.style.setProperty('--wlapp-alignment', { left: 'flex-start', center: 'center', right: 'flex-end' }[values.alignment] || 'flex-start');
    root.style.setProperty('--wlapp-spacing-top', `${spacing(values.spacingTop)}px`);
    root.style.setProperty('--wlapp-spacing-bottom', `${spacing(values.spacingBottom)}px`);
    root.style.setProperty('--wlapp-radius', radius);
  }

  function setupProductEmbed(embed, config) {
    const pageConfig = surface(config, 'productPage');
    if (!embed.dataset.productId || document.querySelector('[data-wishlist-product-button]')) return;
    embed.dataset.wlappProductButton = 'true';
    embed.dataset.iconStyle = pageConfig.icon || config.iconStyle || 'heart';
    embed.dataset.cardStyle = 'minimal';
    embed.dataset.border = pageConfig.showBorder === false ? 'none' : 'visible';
    embed.dataset.label=pageConfig.label||config.buttonLabel||'Save to wishlist';
    embed.dataset.wlappPosition=config.productButtonPosition||'product-info';
    embed.dataset.color = pageConfig.accentColor || config.accentColor || '#FF5C01';
    embed.dataset.textColor = pageConfig.textColor || config.textColor || '#202223'; embed.dataset.iconColor = pageConfig.iconColor || config.iconColor || config.accentColor || '#FF5C01'; embed.dataset.display = pageConfig.display || config.productButtonDisplay || 'both'; embed.dataset.toast = config.toastMessage || ''; embed.dataset.zIndex = config.zIndex || '20';
    embed.innerHTML = `<button type="button" class="wlapp-button" data-wishlist-button><span class="wlapp-icon" data-wishlist-icon aria-hidden="true">${heartIcon}</span><span data-wishlist-label></span></button>`;
    styleProductControl(embed, pageConfig);
    placeProductControl(embed, pageConfig.placement || embed.dataset.wlappPosition || 'above-cart');
    init(embed);
  }

  function placeProductControl(control, placement) {
    control.style.setProperty('position', 'static', 'important');
    control.style.setProperty('inset', 'auto', 'important');
    control.style.setProperty('transform', 'none', 'important');
    const info = document.querySelector('[data-product-info], .product__info-wrapper, .product__info-container, .product-info');
    const form = info?.querySelector('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
    if (!info || !control) return;
    const title = info.querySelector('h1, [class*="product__title"], [class*="product-title"]');
    const price = info.querySelector('[class*="price"], .price');
    const variants = info.querySelector('variant-selects, variant-radios, [class*="variant"], [name="id"]')?.closest('fieldset, .product-form__input, variant-selects, variant-radios');
    const insertAfter = (target) => target?.parentElement?.insertBefore(control, target.nextSibling);
    if (placement === 'before-title' && title) title.parentElement.insertBefore(control, title);
    else if (placement === 'after-title') insertAfter(title);
    else if (placement === 'after-price') insertAfter(price);
    else if (placement === 'after-variants') insertAfter(variants);
    else if (placement === 'below-cart' && form?.parentElement) insertAfter(form);
    else if (placement === 'above-cart' && form?.parentElement) form.parentElement.insertBefore(control, form);
    else if (!info.contains(control)) info.appendChild(control);
    // A static button still sticks when its product-information parent is sticky.
    // Only release ancestors of this control, never the site's sticky header.
    let ancestor = control.parentElement;
    while (ancestor && ancestor !== document.body) {
      if (getComputedStyle(ancestor).position === 'sticky') {
        ancestor.classList.add('wlapp-product-normal-flow');
      }
      ancestor = ancestor.parentElement;
    }
  }

  async function mergeServerItems(config) {
    shopScope = config.shop || shopScope;
    customerScope = config.customerId ? `customer:${config.customerId}` : 'guest';
    if (!config.customerId) return;
    const server = normalizeItems(config.items);
    const guestKey = `wishlist_app:v2:${shopScope}:guest`;
    // Only explicitly guest-owned saves may be transferred on login. Never import
    // the old unowned v1 cache or another customer's cached wishlist.
    if (config.customerWishlists !== false && surface(config, 'general').mergeGuestWishlists !== false) {
      let guest = {};
      try { guest = normalizeItems(JSON.parse(localStorage.getItem(guestKey) || '{}')); } catch { /* Empty guest cache. */ }
      for (const [key, item] of Object.entries(guest)) {
        if (!server[key]) {
          const response = await send({ action: 'add', eventType: 'wishlist_merge', ...item });
          if (!response.ok) continue;
          server[key] = item;
        }
        delete guest[key];
        localStorage.setItem(guestKey, JSON.stringify(guest));
      }
    }
    // Server removals win over stale cached items instead of resurrecting them.
    writeSaved(server);
  }

  function updateCount() { const count = Object.keys(readSaved()).length; document.querySelectorAll('[data-wlapp-count]').forEach((node) => { if (node.textContent !== String(count)) node.textContent = String(count); node.closest('.wlapp-count-bubble')?.classList.toggle('is-empty', count === 0); }); }

  async function refreshCartCount() {
    const response = await fetch(`${rootPath()}cart.js`, { credentials: 'same-origin' }).catch(() => null);
    if (!response?.ok) return;
    const cart = await response.json().catch(() => null);
    if (!cart) return;
    document.querySelectorAll('[data-cart-count], [data-cart-count-bubble], .cart-count-bubble span, .cart-count').forEach((node) => {
      node.textContent = String(cart.item_count);
    });
    document.dispatchEvent(new CustomEvent('cart:refresh', { detail: cart }));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
  }

  function addHeaderLink(config) {
    const general = surface(config, 'general');
    const enabled = typeof general.showWishlistLink === 'boolean'
      ? general.showWishlistLink : config.showWishlistLink === true;
    if (!enabled) {
      document.querySelectorAll('[data-wlapp-header-link]').forEach((link) => link.remove());
      return;
    }
    let headers = [...document.querySelectorAll('.header__icons, [data-header-icons], .header__actions, header-actions, .header-actions')];
    if (!headers.length) {
      const cart = document.querySelector('header a[href$="/cart"], .shopify-section-header a[href$="/cart"]');
      if (cart?.parentElement) headers = [cart.parentElement];
    }
    // Avoid placing duplicate links in nested action containers.
    headers = headers.filter((header) => !headers.some((other) => other !== header && header.contains(other)));
    headers.forEach((header) => addHeaderLinkToContainer(header, general));
  }

  function addHeaderLinkToContainer(header, general) {
    let link = header.querySelector('[data-wlapp-header-link], .wlapp-header-link');
    const pagePath = String(general.wishlistPagePath || '/pages/wishlist').trim();
    const safePath = `/${pagePath.replace(/^\/+/, '').replace(/[?#].*$/, '')}`;
    if (!link) {
      link = document.createElement('a');
      link.className = 'wlapp-header-link header__icon header__icon--wishlist link focus-inset';
      link.dataset.wlappHeaderLink = 'true';
    link.innerHTML = `<svg class="icon icon-wishlist" aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">${heartIcon.match(/<path[^>]*>/)?.[0] || ''}</svg><span class="visually-hidden">Wishlist</span><div class="wlapp-count-bubble"><span aria-hidden="true" data-wlapp-count>0</span><span class="visually-hidden"><span data-wlapp-count>0</span> items</span></div>`;
    }
    link.href = `${rootPath()}${safePath.replace(/^\//, '')}`;
    const customIcon = String(general.headerIcon || '');
    const icon = link.querySelector('.icon-wishlist');
    if (customIcon && icon?.localName === 'svg') {
      const image = document.createElement('img');
      image.className = 'icon icon-wishlist';
      image.alt = '';
      image.src = customIcon;
      icon.replaceWith(image);
    } else if (!customIcon && icon?.localName === 'img') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.className.baseVal = 'icon icon-wishlist';
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('viewBox', '0 0 50 50');
      svg.innerHTML = heartIcon.match(/<path[^>]*>/)?.[0] || '';
      icon.replaceWith(svg);
    }
    const heart = link.querySelector('.icon-wishlist path');
    const iconSize = (value, fallback) => ['18', '20', '24', '28', '32'].includes(String(value)) ? String(value) : fallback;
    const iconWidth = iconSize(general.headerIconWidth, '24');
    const iconHeight = iconSize(general.headerIconHeight, '24');
    const headerIcon = link.querySelector('.icon-wishlist');
    if (headerIcon) {
      headerIcon.style.setProperty('width', `${iconWidth}px`, 'important');
      headerIcon.style.setProperty('height', `${iconHeight}px`, 'important');
    }
    if (heart && !customIcon) {
      const strokeWidth = ['0', '1', '1.8', '2.5', '3'].includes(String(general.headerIconStrokeWidth)) ? String(general.headerIconStrokeWidth) : '1.8';
      heart.setAttribute('fill', general.headerIconFill === true ? 'currentColor' : 'none');
      heart.setAttribute('stroke', 'currentColor');
      heart.setAttribute('stroke-width', strokeWidth);
    }
    const position = ['start', 'middle', 'end'].includes(general.headerIconPosition) ? general.headerIconPosition : 'end';
    if (link.parentElement !== header || link.dataset.wlappHeaderPosition !== position) {
      const siblings = [...header.children].filter((child) => child !== link);
      if (position === 'start') header.prepend(link);
      else if (position === 'middle') header.insertBefore(link, siblings[Math.ceil(siblings.length / 2)] || null);
      else header.appendChild(link);
      link.dataset.wlappHeaderPosition = position;
    }
  }

  const catalogRequests = new Map();
  function currentProduct(handle) {
    if (!catalogRequests.has(handle)) {
      catalogRequests.set(handle, fetch(`${rootPath()}products/${encodeURIComponent(handle)}.js`, { cache: 'no-store' })
        .then(async (response) => ({ status: response.status, product: response.ok ? await response.json() : null }))
        .catch(() => ({ status: 0, product: null })));
    }
    return catalogRequests.get(handle);
  }

  async function removeSavedItem(item) {
    activeMutations++;
    try {
      const response = await send({ action: 'remove', productId: item.productId, variantId: item.variantId });
      if (!response.ok) throw new Error('Could not remove this item. Please try again.');
      const latest = readSaved();
      delete latest[canonicalKey(item)];
      writeSaved(latest);
    } finally { activeMutations--; }
  }

  async function addSavedItemToCart(item) {
    activeMutations++;
    try {
      const result = await fetch(`${rootPath()}cart/add.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: String(item.variantId).split('/').pop(), quantity: 1 }] }) });
      const body = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(body.description || 'Could not add this item. Please try again.');
      send({ action: 'analytics', eventType: 'wishlist_move_to_cart', productId: item.productId, variantId: item.variantId });
      send({ action: 'analytics', eventType: 'wishlist_cart_success', productId: item.productId, variantId: item.variantId });
      await refreshCartCount().catch(() => {});
      if (activeConfig.keepInWishlistAfterCart === false) {
        try { await removeSavedItem(item); }
        catch { return 'Added to cart. Could not remove from wishlist; please try Remove.'; }
      }
      return 'Added to cart';
    } finally { activeMutations--; }
  }

  function setupThemedWishlistPage(root) {
    if (!root || root.dataset.wlappPageReady === 'true') return;
    const grid = root.querySelector('[data-wlapp-page-grid]');
    const summary = root.querySelector('[data-wlapp-page-summary]');
    if (!grid) return;
    root.dataset.wlappPageReady = 'true';
    const pageConfig = surface(activeConfig, 'wishlistPage');
    root.style.setProperty('--wlapp-page-accent', pageConfig.accentColor || activeConfig.accentColor || '#FF5C01');
    root.style.setProperty('--wlapp-page-text', pageConfig.textColor || activeConfig.textColor || '#202223');
    root.dataset.cardRadius = pageConfig.cardRadius || 'medium';
    let revision = 0;
    const safe = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const render = async () => {
      const currentRevision = ++revision;
      const entries = Object.values(readSaved());
      if (summary) summary.textContent = `${entries.length} saved item${entries.length === 1 ? '' : 's'}`;
      if (!entries.length) { grid.innerHTML = `<p class="wlapp-empty">${safe(pageConfig.emptyDescription || activeConfig.emptyMessage || 'Your wishlist is empty.')}</p>`; return; }
      const hydrated = await Promise.all(entries.map(async (item) => {
        const handle = item.productHandle || item.handle;
        if (!handle) return { ...item, available: false };
        const { status, product } = await currentProduct(handle);
        if (!product) return { ...item, available: false, catalogError: status !== 404 };
        const variant = product.variants?.find((candidate) => normalizeId(candidate.id, 'ProductVariant') === normalizeId(item.variantId, 'ProductVariant'));
        return { ...item, title: product.title, handle: product.handle, productImage: variant?.featured_image?.src || product.featured_image || '', variantTitle: variant?.title, price: variant?.price, available: Boolean(variant?.available) };
      }));
      if (currentRevision !== revision) return;
      grid.innerHTML = hydrated.map((item, index) => {
        const price = Number.isFinite(item.price) ? new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: shopCurrency || 'USD' }).format(item.price / 100) : '';
        return `<article class="wlapp-themed-item" data-wlapp-item-index="${index}"><a href="${rootPath()}products/${encodeURIComponent(item.handle || '')}">${item.productImage ? `<img src="${safe(item.productImage)}" alt="${safe(item.title)}" loading="lazy">` : ''}</a><div class="wlapp-themed-item__body"><a href="${rootPath()}products/${encodeURIComponent(item.handle || '')}">${safe(item.title || item.productTitle || 'Saved item')}</a>${item.variantTitle && item.variantTitle !== 'Default Title' ? `<p>${safe(item.variantTitle)}</p>` : ''}${price ? `<p>${safe(price)}</p>` : ''}<div class="wlapp-themed-item__actions"><button type="button" class="primary" data-wlapp-cart ${item.available ? '' : 'disabled'}>${item.available ? 'Add to cart' : (item.catalogError ? 'Temporarily unavailable' : 'Unavailable')}</button><button type="button" data-wlapp-remove>Remove</button></div><p role="status" data-wlapp-status></p></div></article>`;
      }).join('');
      grid.querySelectorAll('[data-wlapp-item-index]').forEach((card) => {
        const item = hydrated[Number(card.dataset.wlappItemIndex)];
        const cart = card.querySelector('[data-wlapp-cart]');
        const remove = card.querySelector('[data-wlapp-remove]');
        const status = card.querySelector('[data-wlapp-status]');
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try { await removeSavedItem(item); }
          catch (error) { status.textContent = error.message; remove.disabled = false; }
        });
        cart.addEventListener('click', async () => {
          cart.disabled = true;
          remove.disabled = true;
          status.textContent = 'Adding to cart…';
          try {
            status.textContent = await addSavedItemToCart(item);
          } catch (error) { status.textContent = error.message; }
          finally { cart.disabled = false; remove.disabled = false; }
        });
      });
      updateCount();
    };
    const pageStatus = root.querySelector('[data-wlapp-page-status]');
    const clear = root.querySelector('[data-wlapp-clear]');
    clear?.addEventListener('click', async () => {
      clear.disabled = true;
      activeMutations++;
      try {
        const response = await send({ action: 'clear' });
        if (!response.ok) throw new Error('Could not clear your wishlist. Please try again.');
        writeSaved({});
      } catch (error) { if (pageStatus) pageStatus.textContent = error.message; }
      finally { clear.disabled = false; activeMutations--; }
    });
    const share = root.querySelector('[data-wlapp-share]');
    if (share) share.hidden = activeConfig.wishlistSharing === false;
    share?.addEventListener('click', async () => {
      share.disabled = true;
      try {
        const response = await send({ action: 'share' });
        const body = await response.json();
        if (!response.ok || !body.shareToken) throw new Error('Sign in to share your wishlist.');
        const url = `${location.origin}${rootPath()}apps/wishlist/share/${encodeURIComponent(body.shareToken)}`;
        try { await navigator.clipboard.writeText(url); if (pageStatus) pageStatus.textContent = 'Wishlist link copied'; }
        catch { if (pageStatus) pageStatus.textContent = `Share this link: ${url}`; }
      } catch (error) { if (pageStatus) pageStatus.textContent = error.message; }
      finally { share.disabled = false; }
    });
    document.addEventListener('wlapp:change', render);
    render();
  }

  function boot() {
    fetch(endpoint(), { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('Wishlist could not load. Please refresh to try again.'); return response.json(); }).then(async (config) => {
      if (config.enabled === false) return;
      if (!shopCurrency) {
        const cart = await fetch(`${rootPath()}cart.js`).then((response) => response.ok ? response.json() : null).catch(() => null);
        shopCurrency = cart?.currency;
      }
      activeConfig = config;
      document.addEventListener('wlapp:change', updateCount);
      await mergeServerItems(config);
      keepSingleProductButton();
      addHeaderLink(config);
      document.querySelectorAll('[data-wishlist-page]').forEach((root) => setupThemedWishlistPage(root));
      const pageEnabled = config.showOnProductPages !== false && surface(config, 'productPage').enabled !== false;
      document.querySelectorAll('[data-wishlist-product-button], [data-wishlist-embed]').forEach((root) => { root.hidden = !pageEnabled; });
      if (pageEnabled) {
        const cardConfig = surface(config, 'productCard');
        const pageConfig = surface(config, 'productPage');
        document.querySelectorAll('[data-wishlist-root]').forEach((root) => {
          const isProductPage = root.matches('[data-wishlist-product-button]');
          const values = isProductPage ? pageConfig : cardConfig;
          root.dataset.iconStyle = values.icon || config.iconStyle || 'heart';
          root.dataset.cardStyle = isProductPage ? 'minimal' : (values.style || 'minimal');
          root.dataset.border = isProductPage && values.showBorder === false ? 'none' : 'visible';
          root.dataset.position = values.position || 'top-right';
          root.dataset.size = values.size || 'medium';
          root.dataset.label = values.label || config.buttonLabel || 'Save to wishlist';
          root.dataset.textColor = values.textColor || config.textColor || '#202223';
          root.dataset.iconColor = values.iconColor || config.iconColor || config.accentColor || '#FF5C01';
          root.dataset.color = values.accentColor || values.iconColor || config.accentColor || '#FF5C01';
          root.dataset.display = values.display || config.productButtonDisplay || 'both';
          root.dataset.toast = config.toastMessage || '';
          root.dataset.zIndex = config.zIndex || '20';
          if (isProductPage) {
            styleProductControl(root, values);
            placeProductControl(root, values.placement || config.productButtonPosition || 'above-cart');
          }
          init(root);
        });
        document.querySelectorAll('[data-wishlist-embed]').forEach((embed) => setupProductEmbed(embed, config));
      }
      addCardButtons(config); updateCount();
      let scheduled = false;
      const observer = new MutationObserver(() => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; addHeaderLink(config); addCardButtons(config); updateCount(); }); });
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY()) document.dispatchEvent(new CustomEvent('wlapp:change'));
      });
      window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
      window.addEventListener('focus', async () => {
        if (pendingItems.size || activeMutations) return;
        const revision = stateRevision;
        const latest = await fetch(endpoint(), { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null);
        if (!latest || pendingItems.size || activeMutations || revision !== stateRevision) return;
        activeConfig = latest;
        await mergeServerItems(latest);
        catalogRequests.clear();
        document.dispatchEvent(new CustomEvent('wlapp:change'));
      });
    }).catch((error) => {
      document.querySelectorAll('[data-wlapp-page-summary]').forEach((node) => { node.textContent = error.message; });
      showToast(error.message);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
