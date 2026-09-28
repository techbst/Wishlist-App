/* eslint-disable react/prop-types */
import { useFetcher, useLoaderData } from "react-router";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  customizationDefaults,
  GeneralPreview,
  ProductCardPreview,
  ProductPagePreview,
  WishlistPagePreview,
  mergeCustomization,
} from "../components/customization-previews";

const defaults = {
  enabled: true,
  buttonLabel: "Save to wishlist",
  accentColor: "#FF5C01",
  textColor: "#202223",
  iconColor: "#FF5C01",
  toastMessage: "Added to your wishlist",
  productButtonDisplay: "both",
  zIndex: 20,
  showOnProductPages: true,
  showOnCollectionPages: true,
  guestWishlists: true,
  customerWishlists: true,
  showOnProductCards: true,
  iconStyle: "heart",
  cardStyle: "floating",
  productButtonPosition: "product-info",
  showWishlistLink: false,
  wishlistSharing: true,
  pageHeading: "My wishlist",
  emptyMessage: "Your wishlist is empty.",
  keepInWishlistAfterCart: true,
  customization: customizationDefaults,
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const record = await db.wishlistSettings.findUnique({
    where: { shop: session.shop },
  });
  const storeHandle = session.shop.replace(/\.myshopify\.com$/i, "");
  return {
    wishlistUrl: `https://${session.shop}/pages/wishlist`,
    themeEditorUrl: `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/themes/current/editor?context=apps`,
    settings: record
      ? { ...record, customization: mergeCustomization(record.customization) }
      : defaults,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const customization = mergeCustomization(formData.get("customization"));
  const productCard = customization.productCard;
  const productPage = customization.productPage;
  const general = customization.general;
  const color = (value, fallback) =>
    /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  const data = {
    enabled: formData.get("enabled") === "true",
    buttonLabel: String(productCard.label || defaults.buttonLabel).slice(0, 40),
    accentColor: color(
      productPage.accentColor || formData.get("accentColor"),
      defaults.accentColor,
    ),
    textColor: color(productCard.textColor, defaults.textColor),
    iconColor: color(productCard.iconColor, defaults.iconColor),
    toastMessage: String(
      formData.get("toastMessage") || defaults.toastMessage,
    ).slice(0, 120),
    productButtonDisplay: ["icon", "text", "both"].includes(productPage.display)
      ? productPage.display
      : defaults.productButtonDisplay,
    zIndex: Math.min(
      1000,
      Math.max(1, Number(formData.get("zIndex")) || defaults.zIndex),
    ),
    showOnProductPages: productPage.enabled,
    showOnCollectionPages: formData.get("showOnCollectionPages") === "true",
    guestWishlists: general.guestWishlists,
    customerWishlists: general.customerWishlists,
    showOnProductCards: productCard.enabled,
    iconStyle: ["heart", "star", "bookmark", "spark"].includes(productCard.icon)
      ? productCard.icon
      : defaults.iconStyle,
    cardStyle: ["floating", "minimal"].includes(productCard.style)
      ? productCard.style
      : defaults.cardStyle,
    productButtonPosition: [
      "before-title",
      "after-title",
      "after-price",
      "after-variants",
      "above-cart",
      "below-cart",
    ].includes(
      productPage.placement,
    )
      ? productPage.placement
      : defaults.productButtonPosition,
    showWishlistLink: general.showWishlistLink,
    wishlistSharing: customization.wishlistPage.showShare !== false,
    pageHeading: String(
      customization.wishlistPage.title || defaults.pageHeading,
    ).slice(0, 80),
    emptyMessage: String(
      customization.wishlistPage.emptyDescription || defaults.emptyMessage,
    ).slice(0, 160),
    keepInWishlistAfterCart: general.keepAfterCart,
    customization: JSON.stringify(customization),
  };
  try {
    await db.wishlistSettings.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, ...data },
      update: data,
    });
  } catch (error) {
    // A running dev server can retain a Prisma Client generated before the latest migration.
    // Preserve the older settings contract so saving does not take down the page; the next
    // restart after `npm run setup` persists the full customization object.
    if (!String(error?.message || "").includes("Unknown argument")) throw error;
    const legacyData = { ...data };
    let legacySaved = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        await db.wishlistSettings.upsert({
          where: { shop: session.shop },
          create: { shop: session.shop, ...legacyData },
          update: legacyData,
        });
        legacySaved = true;
        break;
      } catch (legacyError) {
        const unknownField = String(legacyError?.message || "").match(
          /Unknown argument `([^`]+)`/i,
        )?.[1];
        if (!unknownField || !(unknownField in legacyData)) throw legacyError;
        delete legacyData[unknownField];
      }
    }
    if (!legacySaved)
      throw new Error(
        "Could not save settings with the current Prisma schema.",
      );
    return {
      saved: true,
      compatibilityMode: true,
      settings: { ...data, customization },
    };
  }
  return { saved: true, settings: { ...data, customization } };
};

export default function CustomizationPage() {
  const { settings: initial, wishlistUrl, themeEditorUrl } = useLoaderData();
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    ...initial,
    customization: mergeCustomization(initial.customization),
  });
  const updateSection = (section, field, value) =>
    setSettings((current) => ({
      ...current,
      customization: {
        ...current.customization,
        [section]: { ...current.customization[section], [field]: value },
      },
    }));
  const save = () => {
    const form = new FormData();
    Object.entries(settings).forEach(([key, value]) =>
      form.set(
        key,
        key === "customization" ? JSON.stringify(value) : String(value),
      ),
    );
    fetcher.submit(form, { method: "post" });
  };
  const resetSection = (section) =>
    setSettings((current) => ({
      ...current,
      customization: {
        ...current.customization,
        [section]: { ...customizationDefaults[section] },
      },
    }));
  const discard = () =>
    setSettings({
      ...initial,
      customization: mergeCustomization(initial.customization),
    });
  const customization = settings.customization;
  const tabClass = (tab) =>
    `flex shrink-0 items-center gap-2 rounded-t-lg border-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab ? "active border-wishlist-orange bg-orange-50 text-wishlist-orange" : "border-transparent text-wishlist-muted hover:bg-wishlist-soft hover:text-wishlist-ink"}`;
  return (
    <s-page heading="Customization">
      <div className="settings-page customization-page wl-shell font-sans text-wishlist-ink">
        <div className="settings-hero">
          <div>
            <p className="eyebrow">STOREFRONT CUSTOMIZATION</p>
            <p className="settings-kicker">Product surfaces, considered.</p>
            <p className="muted settings-intro">
              Choose how shoppers discover, save, and return to products across
              your storefront.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <s-button variant="secondary" href={wishlistUrl} target="_blank">
              Open wishlist page
            </s-button>
            <s-button variant="tertiary" href={themeEditorUrl} target="_blank">
              Add widget to theme
            </s-button>
          </div>
        </div>
        <s-card class="customization-workspace ">
          <div
            className="customization-tabs"
            role="tablist"
            aria-label="Wishlist customization sections"
          >
            <button
              className={tabClass("product-card")}
              type="button"
              role="tab"
              aria-selected={activeTab === "product-card"}
              aria-controls="product-card"
              onClick={() => setActiveTab("product-card")}
            >
              <s-icon type="product" size="small" /> Product card
            </button>
            <button
              className={tabClass("product-page")}
              type="button"
              role="tab"
              aria-selected={activeTab === "product-page"}
              aria-controls="product-page"
              onClick={() => setActiveTab("product-page")}
            >
              <s-icon type="page" size="small" /> Product page
            </button>
            <button
              className={tabClass("wishlist-page")}
              type="button"
              role="tab"
              aria-selected={activeTab === "wishlist-page"}
              aria-controls="wishlist-page"
              onClick={() => setActiveTab("wishlist-page")}
            >
              <s-icon type="heart" size="small" /> Wishlist page
            </button>
            <button
              className={tabClass("general")}
              type="button"
              role="tab"
              aria-selected={activeTab === "general"}
              aria-controls="general"
              onClick={() => setActiveTab("general")}
            >
              <s-icon type="settings" size="small" /> General
            </button>
          </div>
          {activeTab === "product-card" && (
            <div
              className="customization-tab-panel block"
              role="tabpanel"
              id="product-card"
              hidden={activeTab !== "product-card"}
            >
              <EditorLayout
                settings={
                  <ProductCardSettings
                    value={customization.productCard}
                    update={(field, value) =>
                      updateSection("productCard", field, value)
                    }
                    reset={() => resetSection("productCard")}
                  />
                }
                preview={
                  <ProductCardPreview settings={customization.productCard} />
                }
              />
            </div>
          )}
          {activeTab === "product-page" && (
            <div
              className="customization-tab-panel block"
              role="tabpanel"
              id="product-page"
              hidden={activeTab !== "product-page"}
            >
              <EditorLayout
                settings={
                  <ProductPageSettings
                    value={customization.productPage}
                    update={(field, value) =>
                      updateSection("productPage", field, value)
                    }
                    reset={() => resetSection("productPage")}
                  />
                }
                preview={
                  <ProductPagePreview settings={customization.productPage} />
                }
              />
            </div>
          )}
          {activeTab === "wishlist-page" && (
            <div
              className="customization-tab-panel block"
              role="tabpanel"
              id="wishlist-page"
              hidden={activeTab !== "wishlist-page"}
            >
              <EditorLayout
                settings={
                  <WishlistPageSettings
                    value={customization.wishlistPage}
                    update={(field, value) =>
                      updateSection("wishlistPage", field, value)
                    }
                    reset={() => resetSection("wishlistPage")}
                  />
                }
                preview={
                  <WishlistPagePreview settings={customization.wishlistPage} />
                }
              />
            </div>
          )}
          {activeTab === "general" && (
            <div
              className="customization-tab-panel block"
              role="tabpanel"
              id="general"
            >
              <EditorLayout
                settings={
                  <GeneralSettings
                    value={customization.general}
                    update={(field, value) =>
                      updateSection("general", field, value)
                    }
                    reset={() => resetSection("general")}
                  />
                }
                preview={<GeneralPreview />}
              />
            </div>
          )}
          <div className="settings-footer">
            <span className="save-status">
              {fetcher.state === "submitting"
                ? "Saving…"
                : fetcher.data?.saved
                  ? "All changes saved"
                  : "Unsaved changes"}
            </span>
            {fetcher.data?.saved ? (
              <s-button variant="secondary" onClick={discard}>
                Reset draft
              </s-button>
            ) : (
              <s-button variant="secondary" onClick={discard}>
                Discard
              </s-button>
            )}
            <s-button
              variant="primary"
              onClick={save}
              disabled={fetcher.state === "submitting"}
            >
              Save changes
            </s-button>
          </div>
        </s-card>
      </div>
    </s-page>
  );
}

function EditorLayout({ settings, preview }) {
  return (
    <div className="customization-editor">
      <div className="customization-controls">{settings}</div>
      <div className="customization-preview">
        <div className="preview-label">
          <span>LIVE PREVIEW</span>
          <s-badge tone="info">Preview only</s-badge>
        </div>
        {preview}
      </div>
    </div>
  );
}

function ProductCardSettings({ value, update, reset }) {
  return (
    <>
      <EditorCard
        title="Wishlist button"
        description="Control where shoppers save products while browsing."
        reset={reset}
      >
        <Setting
          title="Enable on product cards"
          description="Show the wishlist action on collection, search, featured, and related product cards."
          enabled={value.enabled}
          onChange={() => update("enabled", !value.enabled)}
        />
        {field(
          "Style",
          "Choose the most natural presentation for your theme.",
          <Select
            value={value.display}
            onChange={(event) => update("display", event.target.value)}
            options={[
              ["both", "Icon + text"],
              ["icon", "Icon only"],
              ["text", "Text only"],
            ]}
          />,
        )}
        {field(
          "Icon",
          "Use a familiar visual cue for saving.",
          <Select
            value={value.icon}
            onChange={(event) => update("icon", event.target.value)}
            options={[
              ["heart", "Heart"],
              ["star", "Star"],
              ["bookmark", "Bookmark"],
              ["spark", "Spark"],
            ]}
          />,
        )}
        {field(
          "Label",
          "Shown when text is included.",
          <Input
            value={value.label}
            onChange={(event) => update("label", event.target.value)}
          />,
        )}
        {field(
          "Position",
          "Keep the action clear without covering product imagery.",
          <Select
            value={value.position}
            onChange={(event) => update("position", event.target.value)}
            options={[
              ["top-left", "Top left"],
              ["top-right", "Top right"],
              ["bottom-left", "Bottom left"],
              ["bottom-right", "Bottom right"],
            ]}
          />,
        )}
        {field(
          "Size",
          "Use a touch-friendly size across devices.",
          <Select
            value={value.size}
            onChange={(event) => update("size", event.target.value)}
            options={[
              ["small", "Small"],
              ["medium", "Medium"],
              ["large", "Large"],
            ]}
          />,
        )}
      </EditorCard>
      <EditorCard
        title="Appearance"
        description="Match the wishlist control to your storefront styling."
      >
        {field(
          "Icon color",
          "Color used before an item is saved.",
          <Color
            value={value.iconColor}
            onChange={(event) => update("iconColor", event.target.value)}
          />,
        )}
        {field(
          "Text color",
          "Color used by the optional label.",
          <Color
            value={value.textColor}
            onChange={(event) => update("textColor", event.target.value)}
          />,
        )}
        {field(
          "Background",
          "Use a quiet surface over product imagery.",
          <Color
            value={value.background}
            onChange={(event) => update("background", event.target.value)}
          />,
        )}
        {field(
          "Hover background",
          "A subtle response when shoppers point to the control.",
          <Color
            value={value.hoverBackground}
            onChange={(event) => update("hoverBackground", event.target.value)}
          />,
        )}
        {field(
          "Hover icon color",
          "Keep the hover state aligned with your brand.",
          <Color
            value={value.hoverIconColor}
            onChange={(event) => update("hoverIconColor", event.target.value)}
          />,
        )}
        {field(
          "Border radius",
          "Choose the shape that fits your theme.",
          <Select
            value={value.radius}
            onChange={(event) => update("radius", event.target.value)}
            options={[
              ["square", "Square"],
              ["medium", "Medium"],
              ["full", "Pill"],
            ]}
          />,
        )}
      </EditorCard>
      <EditorCard
        title="Visibility"
        description="Choose where the control appears."
      >
        {field(
          "Show on",
          "Enable the surfaces that matter to your shoppers.",
          <div className="choice-grid">
            <Check
              label="Collection cards"
              checked={value.showOnCollection}
              onChange={() =>
                update("showOnCollection", !value.showOnCollection)
              }
            />
            <Check
              label="Search results"
              checked={value.showOnSearch}
              onChange={() => update("showOnSearch", !value.showOnSearch)}
            />
            <Check
              label="Featured products"
              checked={value.showOnFeatured}
              onChange={() => update("showOnFeatured", !value.showOnFeatured)}
            />
            <Check
              label="Desktop"
              checked={value.showOnDesktop}
              onChange={() => update("showOnDesktop", !value.showOnDesktop)}
            />
            <Check
              label="Mobile"
              checked={value.showOnMobile}
              onChange={() => update("showOnMobile", !value.showOnMobile)}
            />
          </div>,
        )}
        {field(
          "Visibility",
          "Keep controls discoverable without adding noise.",
          <Select
            value={value.visibility}
            onChange={(event) => update("visibility", event.target.value)}
            options={[
              ["always", "Always"],
              ["hover", "On hover"],
              ["desktop", "Desktop only"],
              ["mobile", "Mobile only"],
            ]}
          />,
        )}
      </EditorCard>
    </>
  );
}

function ProductPageSettings({ value, update, reset }) {
  return (
    <>
      <EditorCard
        title="Wishlist button"
        description="Make saving easy at the moment a shopper decides to buy."
        reset={reset}
      >
        <Setting
          title="Enable on product pages"
          description="Display the wishlist action on product detail pages."
          enabled={value.enabled}
          onChange={() => update("enabled", !value.enabled)}
        />
        {field(
          "Placement",
          "For exact placement, add the Wishlist block from the Theme Editor.",
          <Select
            value={value.placement}
            onChange={(event) => update("placement", event.target.value)}
            options={[
              ["before-title", "Before product title"],
              ["after-title", "After product title"],
              ["after-price", "After price"],
              ["after-variants", "After variants"],
              ["above-cart", "Above Add to cart"],
              ["below-cart", "Below Add to cart"],
            ]}
          />,
        )}
        {field(
          "Style",
          "Choose an icon, label, or both.",
          <Select
            value={value.display}
            onChange={(event) => update("display", event.target.value)}
            options={[
              ["both", "Icon + text"],
              ["icon", "Icon only"],
              ["text", "Text only"],
            ]}
          />,
        )}
        <Setting
          title="Show button border"
          description="Keep or remove the outline around the product-page wishlist button."
          enabled={value.showBorder}
          onChange={() => update("showBorder", !value.showBorder)}
        />
        {field(
          "Label",
          "Action-led copy shown beside the icon.",
          <Input
            value={value.label}
            onChange={(event) => update("label", event.target.value)}
          />,
        )}
        {field(
          "Alignment",
          "Align with the product information column.",
          <Select
            value={value.alignment}
            onChange={(event) => update("alignment", event.target.value)}
            options={[
              ["left", "Left"],
              ["center", "Center"],
              ["right", "Right"],
            ]}
          />,
        )}
        {field(
          "Button width",
          "Keep the action proportional to its context.",
          <Select
            value={value.width}
            onChange={(event) => update("width", event.target.value)}
            options={[
              ["auto", "Auto"],
              ["full", "Full width"],
            ]}
          />,
        )}
      </EditorCard>
      <EditorCard
        title="Appearance"
        description="Match the product action to your storefront palette."
      >
        {field(
          "Accent color",
          "Color used for the saved state and border.",
          <Color
            value={value.accentColor}
            onChange={(event) => update("accentColor", event.target.value)}
          />,
        )}
        {field(
          "Icon color",
          "Color used before the item is saved.",
          <Color
            value={value.iconColor}
            onChange={(event) => update("iconColor", event.target.value)}
          />,
        )}
        {field(
          "Text color",
          "Color used by the action label.",
          <Color
            value={value.textColor}
            onChange={(event) => update("textColor", event.target.value)}
          />,
        )}
      </EditorCard>
      <EditorCard
        title="Spacing and behavior"
        description="Use measured spacing around the product purchase flow."
      >
        {field(
          "Top spacing",
          "Space above the wishlist action.",
          <input
            className="settings-input settings-number"
            type="number"
            min="0"
            max="64"
            value={value.spacingTop}
            onChange={(event) =>
              update("spacingTop", Number(event.target.value))
            }
          />,
        )}
        {field(
          "Bottom spacing",
          "Space below the wishlist action.",
          <input
            className="settings-input settings-number"
            type="number"
            min="0"
            max="64"
            value={value.spacingBottom}
            onChange={(event) =>
              update("spacingBottom", Number(event.target.value))
            }
          />,
        )}
        <s-banner tone="info">
          Add the Wishlist block from the Theme Editor to control the exact
          app-block position in your theme.
        </s-banner>
      </EditorCard>
    </>
  );
}

function WishlistPageSettings({ value, update, reset }) {
  return (
    <>
      <EditorCard
        title="Header"
        description="Give the saved-items page a clear, welcoming introduction."
        reset={reset}
      >
        {field(
          "Title",
          "The main heading for the wishlist page.",
          <Input
            value={value.title}
            onChange={(event) => update("title", event.target.value)}
          />,
        )}
        {field(
          "Description",
          "A short explanation beneath the heading.",
          <Input
            value={value.description}
            onChange={(event) => update("description", event.target.value)}
          />,
        )}
        {field(
          "Alignment",
          "Align the page introduction.",
          <Select
            value={value.alignment}
            onChange={(event) => update("alignment", event.target.value)}
            options={[
              ["left", "Left"],
              ["center", "Center"],
              ["right", "Right"],
            ]}
          />,
        )}
        <Setting
          title="Show saved item count"
          description="Help shoppers understand the size of their wishlist."
          enabled={value.showCount}
          onChange={() => update("showCount", !value.showCount)}
        />
        {field(
          "Accent color",
          "Color used for wishlist actions and hover states.",
          <Color
            value={value.accentColor}
            onChange={(event) => update("accentColor", event.target.value)}
          />,
        )}
        {field(
          "Text color",
          "Color used for headings and product names.",
          <Color
            value={value.textColor}
            onChange={(event) => update("textColor", event.target.value)}
          />,
        )}
        {field(
          "Card corners",
          "Choose the shape of saved product cards.",
          <Select
            value={value.cardRadius}
            onChange={(event) => update("cardRadius", event.target.value)}
            options={[
              ["square", "Square"],
              ["medium", "Medium"],
              ["full", "Rounded"],
            ]}
          />,
        )}
      </EditorCard>
      <EditorCard
        title="Product grid"
        description="Keep saved products easy to scan on every screen."
      >
        {field(
          "Desktop columns",
          "Choose a comfortable desktop density.",
          <Select
            value={String(value.desktopColumns)}
            onChange={(event) =>
              update("desktopColumns", Number(event.target.value))
            }
            options={[
              ["2", "2 columns"],
              ["3", "3 columns"],
              ["4", "4 columns"],
            ]}
          />,
        )}
        {field(
          "Image ratio",
          "Choose the image shape used by saved products.",
          <Select
            value={value.imageRatio}
            onChange={(event) => update("imageRatio", event.target.value)}
            options={[
              ["square", "Square"],
              ["portrait", "Portrait"],
              ["landscape", "Landscape"],
            ]}
          />,
        )}
      </EditorCard>
      <EditorCard
        title="Product information and actions"
        description="Show only the details shoppers need to make their next decision."
      >
        <div className="choice-grid">
          <Check
            label="Product title"
            checked={value.showTitle}
            onChange={() => update("showTitle", !value.showTitle)}
          />
          <Check
            label="Variant"
            checked={value.showVariant}
            onChange={() => update("showVariant", !value.showVariant)}
          />
          <Check
            label="Price"
            checked={value.showPrice}
            onChange={() => update("showPrice", !value.showPrice)}
          />
          <Check
            label="Compare-at price"
            checked={value.showCompareAt}
            onChange={() => update("showCompareAt", !value.showCompareAt)}
          />
          <Check
            label="Availability"
            checked={value.showAvailability}
            onChange={() => update("showAvailability", !value.showAvailability)}
          />
          <Check
            label="Add to cart"
            checked={value.showAddToCart}
            onChange={() => update("showAddToCart", !value.showAddToCart)}
          />
          <Check
            label="Remove"
            checked={value.showRemove}
            onChange={() => update("showRemove", !value.showRemove)}
          />
          <Check
            label="Share"
            checked={value.showShare}
            onChange={() => update("showShare", !value.showShare)}
          />
        </div>
      </EditorCard>
      <EditorCard
        title="Empty state"
        description="Guide shoppers when they have not saved anything yet."
      >
        {field(
          "Heading",
          "The first message shoppers see.",
          <Input
            value={value.emptyHeading}
            onChange={(event) => update("emptyHeading", event.target.value)}
          />,
        )}
        {field(
          "Description",
          "Explain what to do next.",
          <Input
            value={value.emptyDescription}
            onChange={(event) => update("emptyDescription", event.target.value)}
          />,
        )}
      </EditorCard>
    </>
  );
}

function GeneralSettings({ value, update, reset }) {
  return (
    <>
      <EditorCard
        title="Wishlist behavior"
        description="Choose how saved products work for guests and customers."
        reset={reset}
      >
        <Setting
          title="Guest wishlists"
          description="Let shoppers save without signing in."
          enabled={value.guestWishlists}
          onChange={() => update("guestWishlists", !value.guestWishlists)}
        />
        <Setting
          title="Customer wishlists"
          description="Sync signed-in shoppers across devices."
          enabled={value.customerWishlists}
          onChange={() => update("customerWishlists", !value.customerWishlists)}
        />
        <Setting
          title="Merge guest items"
          description="Move browser-saved items into a customer wishlist after sign-in."
          enabled={value.mergeGuestWishlists}
          onChange={() =>
            update("mergeGuestWishlists", !value.mergeGuestWishlists)
          }
        />
        <Setting
          title="Keep after add to cart"
          description="Leave saved items in the wishlist after cart add."
          enabled={value.keepAfterCart}
          onChange={() => update("keepAfterCart", !value.keepAfterCart)}
        />
        <Setting
          title="Show Wishlist link in header"
          description="Add a Wishlist link to your theme header icons when the app embed is enabled."
          enabled={value.showWishlistLink}
          onChange={() => update("showWishlistLink", !value.showWishlistLink)}
        />
        {field(
          "Wishlist page path",
          "Internal storefront path used by the header icon, for example /pages/wishlist.",
          <Input
            value={value.wishlistPagePath}
            onChange={(event) =>
              update("wishlistPagePath", event.target.value)
            }
          />,
        )}
        {field(
          "Header icon",
          "Upload a custom SVG, PNG, or JPG for the Wishlist header icon.",
          <IconUpload
            value={value.headerIcon}
            onChange={(icon) => update("headerIcon", icon)}
          />,
        )}
        {field(
          "Header icon position",
          "Choose where the Wishlist icon appears inside the header icons group.",
          <Select
            value={value.headerIconPosition}
            onChange={(event) =>
              update("headerIconPosition", event.target.value)
            }
            options={[
              ["start", "Start"],
              ["middle", "Middle"],
              ["end", "End"],
            ]}
          />,
        )}
        {field(
          "Header icon stroke width",
          "Set the outline thickness of the default heart icon.",
          <Select
            value={String(value.headerIconStrokeWidth)}
            onChange={(event) => update("headerIconStrokeWidth", event.target.value)}
            options={[
              ["0", "None"],
              ["1", "Light"],
              ["1.8", "Regular"],
              ["2.5", "Bold"],
              ["3", "Extra bold"],
            ]}
          />,
        )}
        {field(
          "Header icon width",
          "Set the width of the Wishlist header icon in pixels.",
          <Select
            value={String(value.headerIconWidth)}
            onChange={(event) => update("headerIconWidth", event.target.value)}
            options={[["18", "18 px"], ["20", "20 px"], ["24", "24 px"], ["28", "28 px"], ["32", "32 px"]]}
          />,
        )}
        {field(
          "Header icon height",
          "Set the height of the Wishlist header icon in pixels.",
          <Select
            value={String(value.headerIconHeight)}
            onChange={(event) => update("headerIconHeight", event.target.value)}
            options={[["18", "18 px"], ["20", "20 px"], ["24", "24 px"], ["28", "28 px"], ["32", "32 px"]]}
          />,
        )}
        <Setting
          title="Fill header heart icon"
          description="Fill the default heart instead of showing only its outline."
          enabled={value.headerIconFill}
          onChange={() => update("headerIconFill", !value.headerIconFill)}
        />
      </EditorCard>
      <EditorCard
        title="Global appearance and accessibility"
        description="Keep the experience consistent and considerate across the storefront."
      >
        <Setting
          title="Subtle animations"
          description="Use restrained button and save-state transitions."
          enabled={value.subtleAnimations}
          onChange={() => update("subtleAnimations", !value.subtleAnimations)}
        />
        <Setting
          title="Respect reduced motion"
          description="Reduce motion when shoppers prefer it in their device settings."
          enabled={value.reducedMotion}
          onChange={() => update("reducedMotion", !value.reducedMotion)}
        />
        {field(
          "Spacing scale",
          "Choose the overall rhythm of wishlist surfaces.",
          <Select
            value={value.spacing}
            onChange={(event) => update("spacing", event.target.value)}
            options={[
              ["compact", "Compact"],
              ["comfortable", "Comfortable"],
              ["spacious", "Spacious"],
            ]}
          />,
        )}
        {field(
          "Border radius",
          "Use a consistent shape across wishlist controls.",
          <Select
            value={value.radius}
            onChange={(event) => update("radius", event.target.value)}
            options={[
              ["square", "Square"],
              ["medium", "Medium"],
              ["full", "Pill"],
            ]}
          />,
        )}
      </EditorCard>
    </>
  );
}

function EditorCard({ title, description, reset, children }) {
  return (
    <div className="editor-section">
      <div className="editor-section-copy">
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      <s-card class="editor-card block overflow-hidden rounded-xl border border-wishlist-line bg-white p-0 shadow-sm">
        <div className="editor-card-inner space-y-1 px-6 py-6">
          <div className="editor-card-heading flex min-h-2.5 justify-end pt-2">
            {reset && (
              <s-button variant="tertiary" onClick={reset}>
                Reset section
              </s-button>
            )}
          </div>
          {children}
        </div>
      </s-card>
    </div>
  );
}
function Setting({ title, description, enabled, onChange }) {
  return (
    <div className="settings-panel-row">
      <s-switch
        label={title}
        details={description}
        checked={enabled}
        onChange={onChange}
      />
    </div>
  );
}
function field(title, description, control) {
  return (
    <div className="settings-panel-row">
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {control}
    </div>
  );
}
function Input({ value, onChange }) {
  return (
    <input
      className="settings-input settings-input-wide"
      value={value}
      onChange={onChange}
    />
  );
}
function IconUpload({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="settings-input settings-input-wide"
        type="file"
        accept="image/svg+xml,image/png,image/jpeg"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || file.size > 300000) return;
          const reader = new FileReader();
          reader.onload = () => onChange(String(reader.result || ""));
          reader.readAsDataURL(file);
        }}
      />
      {value ? (
        <button type="button" className="text-xs text-wishlist-orange" onClick={() => onChange("")}>
          Remove
        </button>
      ) : null}
    </div>
  );
}
function Color({ value, onChange }) {
  return (
    <input
      className="color-input"
      type="color"
      value={value}
      onChange={onChange}
    />
  );
}
function Select({ value, onChange, options }) {
  return (
    <select className="settings-input" value={value} onChange={onChange}>
      {options.map(([option, label]) => (
        <option value={option} key={option}>
          {label}
        </option>
      ))}
    </select>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <label className="custom-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
