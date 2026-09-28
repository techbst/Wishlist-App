(function () {
  const STORAGE_KEY=()=>`wishlist_app:v1:${window.Shopify?.shop||location.hostname}`;
  const heartIcon = '<svg class="wlapp-heart-svg" width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M25 39.7l-.6-.5C11.5 28.7 8 25 8 19c0-5 4-9 9-9 4.1 0 6.4 2.3 8 4.1 1.6-1.8 3.9-4.1 8-4.1 5 0 9 4 9 9 0 6-3.5 9.7-16.4 20.2l-.6.5zM17 12c-3.9 0-7 3.1-7 7 0 5.1 3.2 8.5 15 18.1 11.8-9.6 15-13 15-18.1 0-3.9-3.1-7-7-7-3.5 0-5.4 2.1-6.9 3.8L25 17.1l-1.1-1.3C22.4 14.1 20.5 12 17 12z" fill="currentColor"/></svg>';
  const icons = { heart: [heartIcon, heartIcon], star: ['☆', '★'], bookmark: ['▱', '▰'], spark: ['✧', '✦'] };
  const rootPath=()=>window.Shopify?.routes?.root||'/';
  const endpoint = () => `${rootPath()}apps/wishlist?format=json`;
  const normalizeId = (id, type = 'Product') => { const value = String(id || ''); return value ? (value.startsWith('gid://') ? value : `gid://shopify/${type}/${value}`) : ''; };
  const readSaved = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY()) || '{}'); } catch { return {}; } };
  const writeSaved = (items) => localStorage.setItem(STORAGE_KEY(), JSON.stringify(items));
  const sessionKey = () => { let value = localStorage.getItem('wishlist_app:session'); if (!value) { value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; localStorage.setItem('wishlist_app:session', value); } return value; };
  const getVariantId = (root) => document.querySelector('[name="id"]')?.value || root.dataset.variantId;
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
      button.classList.toggle('wlapp-saved', saved);
      button.classList.toggle('wlapp-loading', loading);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? 'Remove from wishlist' : label);
      if (iconNode) iconNode.innerHTML = saved ? icon[1] : icon[0];
      if (labelNode) labelNode.textContent = saved ? 'Saved to wishlist' : label;
    };
    const refresh=()=>render(Boolean(readSaved()[itemKey(root)]));
    refresh();
    document.querySelectorAll('[name="id"], select[name^="options"], [data-option-selector]').forEach((selector) => selector.addEventListener('change', refresh));
    document.addEventListener('variant:change', refresh);
    button.addEventListener('click', async () => {
      const key=itemKey(root);
      const saved=readSaved();
      const wasSaved = Boolean(saved[key]);
      const next = { ...saved };
      if (wasSaved) delete next[key]; else next[key] = { ...productPayload(root), title: root.dataset.productTitle, handle: root.dataset.productHandle };
      writeSaved(next);
      updateCount();
      render(!wasSaved, true);
      const response = await send({ action: wasSaved ? 'remove' : 'add', eventType: wasSaved ? 'wishlist_remove' : 'wishlist_add', ...productPayload(root) });
      if (response && !response.ok) { writeSaved(saved); updateCount(); refresh(); } else { render(!wasSaved, false); showToast(root.dataset.toast || (wasSaved ? 'Removed from your wishlist' : 'Added to your wishlist'), root.dataset.zIndex); }
    });
  }

  function showToast(message, zIndex) {
    if (!message) return;
    let toast = document.querySelector('[data-wlapp-toast]');
    if (!toast) { toast = document.createElement('div'); toast.dataset.wlappToast = 'true'; toast.className = 'wlapp-toast'; document.body.appendChild(toast); }
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
    if (!card || card.querySelector('.wlapp-card-root') || card.dataset.wlappPending === 'true') return;
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
    controls.forEach((control, index) => {
      if (index > 0) control.remove();
    });
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
    placeProductControl(embed, embed.dataset.wlappPosition || 'above-cart');
    init(embed);
  }

  function placeProductControl(control, placement) {
    control.style.setProperty('position', 'static', 'important');
    control.style.setProperty('inset', 'auto', 'important');
    control.style.setProperty('transform', 'none', 'important');
    const info = document.querySelector('[data-product-info], .product__info-wrapper, .product__info-container, .product-info');
    const form = document.querySelector('form[action*="/cart/add"]');
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
  }

  function mergeServerItems(config) {
    if (!config.customerId || !Array.isArray(config.items)) return;
    const local = readSaved();
    const serverKeys = new Set(config.items.map((item) => normalizeId(item.variantId || item.productId, item.variantId ? 'ProductVariant' : 'Product')));
    const guestOnly = Object.entries(local).filter(([key]) => !serverKeys.has(key));
    for (const [, item] of guestOnly) if (item.productId) send({ action: 'add', eventType: 'wishlist_merge', ...item });
    for (const item of config.items) local[normalizeId(item.variantId || item.productId, item.variantId ? 'ProductVariant' : 'Product')] = { ...item, title: item.productTitle, handle: item.productHandle };
    writeSaved(local);
  }

  function updateCount() { const count = Object.keys(readSaved()).length; document.querySelectorAll('[data-wlapp-count]').forEach((node) => { node.textContent = String(count); node.closest('.wlapp-count-bubble')?.classList.toggle('is-empty', count === 0); }); }

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
    const header = document.querySelector('.header__icons, [class*="header__icons"]');
    if (!header) return;
    const general = surface(config, 'general');
    if (config.showWishlistLink !== true) return;
    let link = document.querySelector('[data-wlapp-header-link], .wlapp-header-link');
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
    if (customIcon && icon?.tagName === 'SVG') {
      const image = document.createElement('img');
      image.className = 'icon icon-wishlist';
      image.alt = '';
      image.src = customIcon;
      icon.replaceWith(image);
    } else if (!customIcon && icon?.tagName === 'IMG') {
      const svg = document.createElement('svg');
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
    if (link.dataset.wlappHeaderPosition !== position) {
      const siblings = [...header.children].filter((child) => child !== link);
      if (position === 'start') header.prepend(link);
      else if (position === 'middle') header.insertBefore(link, siblings[Math.ceil(siblings.length / 2)] || null);
      else header.appendChild(link);
      link.dataset.wlappHeaderPosition = position;
    }
  }

  async function setupThemedWishlistPage(root) {
    if (!root || root.dataset.wlappPageReady === 'true') return;
    root.dataset.wlappPageReady = 'true';
    const grid = root.querySelector('[data-wlapp-page-grid]');
    const summary = root.querySelector('[data-wlapp-page-summary]');
    if (!grid) return;
    const saved = readSaved();
    const response = await fetch(endpoint(), { credentials: 'same-origin' }).catch(() => null);
    const serverConfig = response?.ok ? await response.json().catch(() => ({})) : {};
    const pageConfig = surface(serverConfig, 'wishlistPage');
    root.style.setProperty('--wlapp-page-accent', pageConfig.accentColor || serverConfig.accentColor || '#FF5C01');
    root.style.setProperty('--wlapp-page-text', pageConfig.textColor || serverConfig.textColor || '#202223');
    root.dataset.cardRadius = pageConfig.cardRadius || 'medium';
    Object.values(serverConfig.items || {}).forEach((item) => {
      const key = item.variantId || item.productId;
      if (key) saved[key] = { ...item, title: item.productTitle, handle: item.productHandle };
    });
    writeSaved(saved);
    await Promise.all(Object.values(saved).filter((item) => !item.productImage && item.handle).map(async (item) => {
      const productResponse = await fetch(`${rootPath()}products/${encodeURIComponent(item.handle)}.js`).catch(() => null);
      const product = productResponse?.ok ? await productResponse.json().catch(() => null) : null;
      if (product?.featured_image) item.productImage = product.featured_image;
    }));
    writeSaved(saved);
    const entries = Object.values(saved);
    if (summary) summary.textContent = `${entries.length} saved item${entries.length === 1 ? '' : 's'}`;
    if (!entries.length) {
      grid.innerHTML = '<p class="wlapp-empty">Your wishlist is empty.</p>';
      return;
    }
    const safe = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    grid.innerHTML = entries.map((item, index) => `<article class="wlapp-themed-item" data-wlapp-item-index="${index}"><a href="/products/${encodeURIComponent(item.handle || '')}"><img src="${safe(item.productImage)}" alt=""></a><div class="wlapp-themed-item__body"><a href="/products/${encodeURIComponent(item.handle || '')}">${safe(item.title || 'Saved item')}</a><div class="wlapp-themed-item__actions"><button type="button" class="primary" data-wlapp-cart>Add to cart</button><button type="button" data-wlapp-remove>Remove</button></div></div></article>`).join('');
    grid.querySelectorAll('[data-wlapp-item-index]').forEach((card) => {
      const item = entries[Number(card.dataset.wlappItemIndex)];
      card.querySelector('[data-wlapp-cart]').addEventListener('click', async () => {
        const variantId = Number(String(item.variantId || '').split('/').pop());
        if (!variantId) return;
        const button = card.querySelector('[data-wlapp-cart]');
        button.disabled = true;
        const result = await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }) }).catch(() => null);
        button.textContent = result?.ok ? 'Added' : 'Unavailable';
        if (result?.ok) await refreshCartCount();
        button.disabled = false;
      });
      card.querySelector('[data-wlapp-remove]').addEventListener('click', () => {
        const key = item.variantId || item.productId;
        delete saved[key];
        writeSaved(saved);
        send({ action: 'remove', productId: item.productId, variantId: item.variantId });
        card.remove();
        updateCount();
        if (!grid.querySelector('[data-wlapp-item-index]')) grid.innerHTML = '<p class="wlapp-empty">Your wishlist is empty.</p>';
      });
    });
    updateCount();
  }

  function boot() {
    fetch(endpoint()).then((response) => response.ok ? response.json() : {}).catch(() => ({})).then((config) => {
      if (config.enabled === false) return;
      mergeServerItems(config);
      keepSingleProductButton();
      addHeaderLink(config);
      document.querySelectorAll('[data-wishlist-page]').forEach((root) => setupThemedWishlistPage(root));
      if (config.showOnProductPages !== false) {
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
          if (isProductPage) placeProductControl(root, config.productButtonPosition || 'above-cart');
          init(root);
        });
        document.querySelectorAll('[data-wishlist-embed]').forEach((embed) => setupProductEmbed(embed, config));
      }
      addCardButtons(config); updateCount();
      let scheduled = false;
      const observer = new MutationObserver(() => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; addHeaderLink(config); addCardButtons(config); updateCount(); }); });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
