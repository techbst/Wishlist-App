import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function HelpPage() {
  return (
    <s-page heading="Help">
      <div className="mx-auto max-w-[1240px] px-7 py-7 pb-14 font-sans text-wishlist-ink max-md:px-4 max-md:py-6">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">STOREFRONT SETUP</p>
            <h1>Get Wishlist working on your theme</h1>
            <p className="muted">
              The app uses Shopify&apos;s Theme App Extension, so no
              theme.liquid code changes are required.
            </p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
        <s-card class="performance-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <h2>1. Enable the app embed</h2>
            <p className="muted">
              Open Online Store → Themes → Customize → App embeds. Enable
              Wishlist and click Save. This loads the global wishlist script.
            </p>
            <h2 className="help-heading">2. Add storefront blocks</h2>
            <p className="muted">
              Use the Wishlist button block on product templates, Wishlist page
              link or count in the header, and Floating wishlist link only if
              you want an additional entry point. For the actual page link,
              add the “Wishlist page link” block to your header or navigation
              section. To show your store header and footer, create an Online
              Store page with the handle <code>wishlist</code> and add the
              “Wishlist page content” block to its template.
            </p>
            <h2 className="help-heading">3. Configure the app</h2>
            <p className="muted">
              Open Settings, choose the icon and card style, then click Save
              settings. Changes are read by the storefront app proxy on the next
              page load.
            </p>
          </s-card>
        <s-card class="quick-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <h2>When a button is missing</h2>
            <p className="muted">
              Confirm the embed is enabled, the app proxy is configured as
              /apps/wishlist, and the theme has not blocked app embeds. Product
              cards are discovered after AJAX filtering and infinite-scroll
              updates.
            </p>
            <h2 className="help-heading">When data is missing</h2>
            <p className="muted">
              Guest items remain in browser storage. Signed-in items require the
              Shopify app proxy and the customer ID supplied by Shopify.
              Reinstalling or changing browsers does not remove server-side
              customer items.
            </p>
            <s-button variant="tertiary" href="/app/additional">
              Open settings
            </s-button>
          </s-card>
        </div>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
