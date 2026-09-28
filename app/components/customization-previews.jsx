/* eslint-disable react/prop-types */
import { useMemo } from "react";
import { WishlistMark } from "./wishlist-mark";

const ORANGE = "#FF5C01";

export const customizationDefaults = {
  productCard: {
    enabled: true,
    display: "both",
    icon: "heart",
    label: "Save to wishlist",
    addedLabel: "Saved to wishlist",
    style: "floating",
    position: "top-right",
    size: "medium",
    radius: "full",
    background: "#FFFFFF",
    iconColor: ORANGE,
    textColor: "#202223",
    hoverBackground: "#FFF0E8",
    hoverIconColor: ORANGE,
    showOnCollection: true,
    showOnSearch: true,
    showOnFeatured: true,
    visibility: "always",
    showOnDesktop: true,
    showOnMobile: true,
  },
  productPage: {
    enabled: true,
    placement: "above-cart",
    display: "both",
    icon: "heart",
    label: "Save to wishlist",
    alignment: "left",
    spacingTop: 12,
    spacingBottom: 12,
    width: "auto",
    radius: "medium",
    accentColor: ORANGE,
    iconColor: ORANGE,
    textColor: "#202223",
    showBorder: true,
  },
  wishlistPage: {
    title: "My wishlist",
    description: "Your saved products, all in one place.",
    alignment: "left",
    accentColor: ORANGE,
    textColor: "#202223",
    cardRadius: "medium",
    showCount: true,
    mobileColumns: 1,
    tabletColumns: 2,
    desktopColumns: 3,
    imageRatio: "square",
    showTitle: true,
    showVariant: true,
    showPrice: true,
    showCompareAt: true,
    showAvailability: true,
    showAddToCart: true,
    showRemove: true,
    showShare: true,
    emptyHeading: "Your wishlist is empty",
    emptyDescription:
      "Save products you love and come back to them when you are ready.",
  },
  general: {
    guestWishlists: true,
    customerWishlists: true,
    mergeGuestWishlists: true,
    keepAfterCart: true,
    showWishlistLink: false,
    wishlistPagePath: "/pages/wishlist",
    headerIcon: "",
    headerIconPosition: "end",
    headerIconStrokeWidth: "1.8",
    headerIconFill: false,
    headerIconWidth: "24",
    headerIconHeight: "24",
    subtleAnimations: true,
    reducedMotion: true,
    radius: "medium",
    spacing: "comfortable",
    buttonStyle: "solid",
  },
};

export function mergeCustomization(value) {
  let parsed = {};
  try {
    parsed =
      typeof value === "string" ? JSON.parse(value || "{}") : value || {};
  } catch {
    parsed = {};
  }
  return {
    productCard: {
      ...customizationDefaults.productCard,
      ...(parsed.productCard || {}),
    },
    productPage: {
      ...customizationDefaults.productPage,
      ...(parsed.productPage || {}),
    },
    wishlistPage: {
      ...customizationDefaults.wishlistPage,
      ...(parsed.wishlistPage || {}),
    },
    general: { ...customizationDefaults.general, ...(parsed.general || {}) },
  };
}

function iconFor(icon, filled = false) {
  if (icon === "star") return filled ? "★" : "☆";
  if (icon === "bookmark") return filled ? "▮" : "▯";
  if (icon === "spark") return filled ? "✦" : "✧";
  return filled ? "♥" : "♡";
}

function HeartIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M25 39.7l-.6-.5C11.5 28.7 8 25 8 19c0-5 4-9 9-9 4.1 0 6.4 2.3 8 4.1 1.6-1.8 3.9-4.1 8-4.1 5 0 9 4 9 9 0 6-3.5 9.7-16.4 20.2l-.6.5zM17 12c-3.9 0-7 3.1-7 7 0 5.1 3.2 8.5 15 18.1 11.8-9.6 15-13 15-18.1 0-3.9-3.1-7-7-7-3.5 0-5.4 2.1-6.9 3.8L25 17.1l-1.1-1.3C22.4 14.1 20.5 12 17 12z" fill="currentColor" />
    </svg>
  );
}

function PreviewButton({
  display = "both",
  icon = "heart",
  label = "Save to wishlist",
  color = ORANGE,
  textColor = "#202223",
  background = "#fff",
  showBorder = true,
  added = false,
}) {
  return (
    <div
      className={`preview-wishlist-button preview-display-${display} ${showBorder ? "" : "preview-no-border"}`}
      style={{
        "--preview-icon": color,
        "--preview-text": textColor,
        "--preview-background": background,
      }}
    >
      <span aria-hidden="true">{icon === "heart" ? <HeartIcon /> : iconFor(icon, added)}</span>
      <span>{added ? "Saved to wishlist" : label}</span>
    </div>
  );
}

export function ProductCardPreview({ settings }) {
  const position = settings.position || "top-right";
  const style = useMemo(
    () => ({
      "--preview-button-background": settings.background || "#fff",
      "--preview-icon": settings.iconColor || ORANGE,
      "--preview-text": settings.textColor || "#202223",
    }),
    [settings],
  );
  return (
    <div className="preview-stage">
      <div className="preview-browser-bar">
        <span />
        <span />
        <span />
        <small>your-store.myshopify.com</small>
      </div>
      <div className="preview-store-header">
        <strong>Northstar Supply</strong>
        <span>New arrivals&nbsp;&nbsp; Best sellers&nbsp;&nbsp; About</span>
        <s-icon type="search" size="small" />
      </div>
      <div className="preview-product-card" style={style}>
        <div className={`preview-card-wishlist preview-position-${position}`}>
          <PreviewButton
            display={settings.display}
            icon={settings.icon}
            label={settings.label}
            color={settings.iconColor}
            textColor={settings.textColor}
            background={settings.background}
          />
        </div>
        <div className="preview-product-image">
          <span>Canvas tote</span>
        </div>
        <div className="preview-product-copy">
          <strong>Everyday Canvas Tote</strong>
          <div>
            <span className="preview-price">$49.00</span>
            <span className="preview-compare">$59.00</span>
          </div>
        </div>
      </div>
      <div className="preview-product-card preview-card-muted">
        <div className="preview-product-image preview-image-alt">
          <span>Organic cotton</span>
        </div>
        <div className="preview-product-copy">
          <strong>Essential Cotton Tee</strong>
          <span className="preview-price">$32.00</span>
        </div>
      </div>
    </div>
  );
}

export function ProductPagePreview({ settings }) {
  const placement = settings.placement || "above-cart";
  const button = (
    <PreviewButton
      display={settings.display}
      icon={settings.icon}
      label={settings.label}
            color={settings.iconColor || settings.accentColor || ORANGE}
            textColor={settings.textColor || "#202223"}
            background="#fff"
            showBorder={settings.showBorder}
          />
  );
  return (
    <div className="preview-stage preview-product-page">
      <div className="preview-browser-bar">
        <span />
        <span />
        <span />
        <small>your-store.myshopify.com/products/tote</small>
      </div>
      <div className="preview-store-header">
        <strong>Northstar Supply</strong>
        <span>New arrivals&nbsp;&nbsp; Best sellers</span>
        <s-icon type="bag" size="small" />
      </div>
      <div className="preview-page-product">
        <div className="preview-page-image">
          <span>Canvas tote</span>
        </div>
        <div className="preview-page-info">
          <p className="preview-overline">NORTHSTAR SUPPLY</p>
          {placement === "before-title" && button}
          <h3>Everyday Canvas Tote</h3>
          {placement === "after-title" && button}
          <div className="preview-page-price">$49.00</div>
          {placement === "after-price" && button}
          <p className="preview-description">
            A durable everyday tote made from heavyweight organic cotton.
          </p>
          <div className="preview-select">
            Natural <span>⌄</span>
          </div>
          {placement === "after-variants" && button}
          {placement === "above-cart" && button}
          <div className="preview-cart-button">Add to cart</div>
          {placement === "below-cart" && button}
          <small className="preview-placement-note">
            Wishlist block placement: {settings.placement.replaceAll("-", " ")}
          </small>
        </div>
      </div>
    </div>
  );
}

export function WishlistPagePreview({ settings }) {
  return (
    <div className="preview-stage preview-wishlist-page">
      <div className="preview-browser-bar">
        <span />
        <span />
        <span />
        <small>your-store.myshopify.com/pages/wishlist</small>
      </div>
      <div
        className="preview-page-heading"
        style={{ textAlign: settings.alignment }}
      >
        <p className="preview-overline">SAVED FOR LATER</p>
        <h3>{settings.title}</h3>
        <p>{settings.description}</p>
        {settings.showCount && <s-badge tone="info">3 saved items</s-badge>}
      </div>
      <div
        className="preview-wishlist-grid"
        style={{ "--preview-columns": settings.desktopColumns || 3 }}
      >
        {["Canvas Tote", "Everyday Tee", "Linen Shirt"].map((name, index) => (
          <div className="preview-saved-item" key={name}>
            <div
              className={`preview-saved-image preview-saved-image-${index}`}
            />
            <div className="preview-saved-copy">
              {settings.showTitle && <strong>{name}</strong>}
              {settings.showPrice && <span>$49.00</span>}
              <div className="preview-item-actions">
                {settings.showAddToCart && (
                  <span className="preview-mini-action">Add to cart</span>
                )}
                {settings.showRemove && (
                  <span className="preview-remove">Remove</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GeneralPreview() {
  return (
    <div className="preview-stage preview-general">
      <div className="preview-general-icon">
        <WishlistMark size={29} filled />
      </div>
      <h3>A calmer way to save</h3>
      <p>
        Wishlist controls use the same thoughtful spacing and accessible
        contrast across your storefront.
      </p>
      <s-badge tone="success">Ready for your storefront</s-badge>
    </div>
  );
}
