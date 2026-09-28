/* eslint-disable no-undef, react/prop-types */
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { WishlistMark } from "../components/wishlist-mark";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days")))
    ? Number(url.searchParams.get("days"))
    : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [productsResponse, shop] = await Promise.all([
    admin.graphql(
      `query DashboardProducts { products(first: 12, sortKey: TITLE) { nodes { id title handle featuredImage { url } priceRangeV2 { minVariantPrice { amount currencyCode } } } } }`,
    ),
    db.shop.findUnique({ where: { shopDomain: session.shop } }),
  ]);
  const products = (await productsResponse.json()).data?.products?.nodes || [];
  const events = shop
    ? await db.analyticsEvent.findMany({
        where: { shopId: shop.id, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const additions = events.filter(
    (event) => event.eventType === "wishlist_add",
  );
  const topCounts = new Map();
  additions.forEach((event) =>
    topCounts.set(event.productId, (topCounts.get(event.productId) || 0) + 1),
  );
  const recent = events.slice(0, 6).map((event) => ({
    id: event.id,
    action: event.eventType.replaceAll("_", " "),
    product: event.productId || "Wishlist",
    time: formatTime(event.createdAt),
  }));
  return {
    recent,
    products: products
      .map((product) => ({ ...product, saves: topCounts.get(product.id) || 0 }))
      .sort((a, b) => b.saves - a.saves)
      .slice(0, 5),
    metrics: {
      adds: additions.length,
      views: events.filter((event) => event.eventType === "wishlist_view")
        .length,
      activeWishlists: new Set(
        events
          .map((event) => event.sessionId || event.customerId)
          .filter(Boolean),
      ).size,
      movesToCart: events.filter(
        (event) => event.eventType === "wishlist_move_to_cart",
      ).length,
    },
  };
};

function formatTime(date) {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(date).getTime()) / 60000),
  );
  return minutes < 60
    ? `${minutes} min ago`
    : `${Math.round(minutes / 60)} hr ago`;
}

export default function Index() {
  const { metrics, recent, products } = useLoaderData();
  return (
    <s-page>
      <div className="mx-auto max-w-[1240px] px-7 py-7 pb-14 font-sans text-wishlist-ink max-md:px-4 max-md:py-6">
        <header className="mb-7 flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-wishlist-orange">
              WISHLIST OVERVIEW
            </p>
            <h1 className="flex items-center gap-2 text-3xl font-semibold leading-tight">
              <WishlistMark size={28} /> Wishlist
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-wishlist-muted">
              Understand wishlist activity and improve product engagement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <s-button variant="primary" href="/app/additional">
              Customize wishlist
            </s-button>
          </div>
        </header>
        <section
          className="mb-5 grid grid-cols-4 gap-[18px] max-md:grid-cols-2"
          aria-label="Wishlist metrics"
        >
          <Metric label="Wishlist adds" value={metrics.adds} />
          <Metric label="Wishlist views" value={metrics.views} />
          <Metric label="Wishlist-to-cart" value={metrics.movesToCart} />
          <Metric label="Active wishlists" value={metrics.activeWishlists} />
        </section>
        <div className="mb-6 grid gap-6 [grid-template-columns:minmax(0,1.7fr)_minmax(320px,1fr)] max-md:grid-cols-1">
          <s-card class="performance-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2>Top wishlisted products</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-wishlist-muted">
                  Products shoppers are saving most often.
                </p>
              </div>
              <s-button variant="tertiary" href="/app/wishlist">
                View wishlist
              </s-button>
            </div>
            {products.length ? (
              products.map((product) => (
                <div
                  className="mt-4 flex items-center gap-3 border-t border-[#eff0f1] pt-4"
                  key={product.id}
                >
                  <div className="flex flex-1 flex-col gap-1 text-[11px]">
                    <strong>{product.title}</strong>
                    <span className="text-[10px] text-wishlist-muted">
                      {product.saves} additions
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-xs text-wishlist-muted">
                No wishlist activity yet. Your most-saved products will appear
                here.
              </p>
            )}
          </s-card>
          <s-card class="quick-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2>Storefront experience</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-wishlist-muted">
                  Match the save experience to your brand.
                </p>
              </div>
            </div>
            <s-button variant="tertiary" href="/app/additional">
              Open customization
            </s-button>
          </s-card>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <s-card class="activity-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2>Recent activity</h2>
                <p className="muted">The latest tracked shopper actions.</p>
              </div>
            </div>
            {recent.length ? (
              recent.map((item) => (
                <div
                  className="flex items-center gap-3 border-t border-[#eff0f1] py-3"
                  key={item.id}
                >
                  <div className="flex flex-1 flex-col gap-1 text-[11px]">
                    <strong>{item.action}</strong>
                    <span className="text-wishlist-muted">{item.product}</span>
                  </div>
                  <time>{item.time}</time>
                </div>
              ))
            ) : (
              <p className="py-6 text-xs text-wishlist-muted">
                Your wishlist activity will appear here once shoppers start
                saving products.
              </p>
            )}
          </s-card>
          <s-card class="top-products-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2>Getting started</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-wishlist-muted">
                  Add Wishlist to your theme in a few steps.
                </p>
              </div>
            </div>
            <ol className="my-5 list-decimal space-y-2 pl-5 text-xs leading-7 text-wishlist-muted">
              <li>Enable the Wishlist app embed.</li>
              <li>Add the Wishlist block from the Theme Editor.</li>
              <li>Customize the experience for your storefront.</li>
            </ol>
            <s-button variant="tertiary" href="/app/help">
              View setup guide
            </s-button>
          </s-card>
        </div>
      </div>
    </s-page>
  );
}

function Metric({ label, value }) {
  return (
    <s-card class="metric rounded-xl border border-wishlist-line bg-white shadow-sm">
      <span className="text-xs text-wishlist-muted">{label}</span>
      <strong>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
      <span className="text-[11px] font-semibold text-wishlist-orange">
        Live activity
      </span>
    </s-card>
  );
}
export const headers = (headersArgs) => boundary.headers(headersArgs);
