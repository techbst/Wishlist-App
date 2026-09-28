import { boundary } from "@shopify/shopify-app-react-router/server";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/i, "");
  return {
    wishlistUrl: `https://${shopDomain}/pages/wishlist`,
    themeEditorUrl: `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/themes/current/editor?context=apps`,
  };
};

export default function SettingsPage() {
  const { wishlistUrl, themeEditorUrl } = useLoaderData();
  return (
    <s-page heading="Settings">
      <div className="mx-auto max-w-[1240px] px-7 py-7 pb-14 font-sans text-wishlist-ink max-md:px-4 max-md:py-6">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-wishlist-orange">
              APP SETTINGS
            </p>
            <p className="settings-kicker">
              A confident setup for your storefront.
            </p>
            <p className="muted settings-intro">
              Connect the wishlist experience to your Shopify theme and keep it
              ready for customers.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <s-card class="quick-card settings-link-card overflow-hidden rounded-xl border border-wishlist-line bg-white p-0 shadow-sm">
            <div className="settings-card-content flex flex-col items-start gap-3 px-6 py-6">
              <div className="settings-card-icon mb-4 grid h-9 w-9 place-items-center rounded-lg bg-[#fff0e8] text-wishlist-orange">
                <s-icon type="question-circle" />
              </div>
              <h2>Theme setup</h2>
              <p className="muted">
                Enable the Wishlist app embed and add the wishlist block from
                the Shopify Theme Editor.
              </p>
              <s-button variant="primary" href={themeEditorUrl} target="_blank">
                Add widget in Theme Editor
              </s-button>
            </div>
          </s-card>
          <s-card class="performance-card settings-link-card overflow-hidden rounded-xl border border-wishlist-line bg-white p-0 shadow-sm">
            <div className="settings-card-content flex flex-col items-start gap-3 px-6 py-6">
              <div className="settings-card-icon mb-4 grid h-9 w-9 place-items-center rounded-lg bg-[#fff0e8] text-wishlist-orange">
                <s-icon type="settings" />
              </div>
              <h2>Storefront status</h2>
              <p className="muted">
                Your storefront controls live in Customization, with a live
                preview for every surface.
              </p>
              <s-button variant="tertiary" href="/app/additional">
                Open customization
              </s-button>
            </div>
          </s-card>
        </div>
        <s-card class="quick-card mt-6 rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2>Wishlist page link</h2>
              <p className="muted mt-1">
                Add the Wishlist page link block in the Theme Editor, or use
                this URL in your store navigation.
              </p>
              <code className="mt-3 block break-all rounded-lg bg-wishlist-soft px-3 py-2 text-xs">
                {wishlistUrl}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <s-button variant="secondary" href={wishlistUrl} target="_blank">
                Open wishlist page
              </s-button>
              <s-button variant="tertiary" href="/app/help">
                Setup guide
              </s-button>
            </div>
          </div>
        </s-card>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
