/* eslint-disable react/prop-types */
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days"));
  const days = [1, 7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const since =
    url.searchParams.get("from") &&
    !Number.isNaN(Date.parse(url.searchParams.get("from")))
      ? new Date(url.searchParams.get("from"))
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const until =
    url.searchParams.get("to") &&
    !Number.isNaN(Date.parse(url.searchParams.get("to")))
      ? new Date(`${url.searchParams.get("to")}T23:59:59.999Z`)
      : new Date();
  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  const events = shop
    ? await db.analyticsEvent.findMany({
        where: { shopId: shop.id, createdAt: { gte: since, lte: until } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const count = (type) =>
    events.filter((event) => event.eventType === type).length;
  const products = new Map();
  events
    .filter((event) => event.eventType === "wishlist_add" && event.productId)
    .forEach((event) =>
      products.set(event.productId, {
        id: event.productId,
        adds: (products.get(event.productId)?.adds || 0) + 1,
      }),
    );
  const adds = count("wishlist_add");
  const cartSuccesses = count("wishlist_cart_success");
  return {
    days,
    from: url.searchParams.get("from") || "",
    to: url.searchParams.get("to") || "",
    metrics: {
      adds,
      removes: count("wishlist_remove"),
      movesToCart: count("wishlist_move_to_cart"),
      cartSuccesses,
      conversion: adds ? Math.round((cartSuccesses / adds) * 1000) / 10 : 0,
      activeSessions: new Set(
        events.map((event) => event.sessionId).filter(Boolean),
      ).size,
      activeCustomers: new Set(
        events.map((event) => event.customerId).filter(Boolean),
      ).size,
    },
    topProducts: [...products.values()]
      .sort((a, b) => b.adds - a.adds)
      .slice(0, 10),
    events: events
      .slice(0, 20)
      .map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  };
};

export default function AnalyticsPage() {
  const { days, from, to, metrics, topProducts, events } = useLoaderData();
  return (
    <s-page heading="Analytics">
      <div className="mx-auto max-w-[1240px] px-7 py-7 pb-14 font-sans text-wishlist-ink max-md:px-4 max-md:py-6">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">WISHLIST ANALYTICS</p>
            <h1>Understand what shoppers want</h1>
            <p className="muted">
              Real storefront activity from the last{" "}
              {days === 1 ? "day" : `${days} days`}.
            </p>
          </div>
          <div className="header-actions">
            {[1, 7, 30, 90].map((period) => (
              <s-button
                variant={period === days && !from ? "primary" : "secondary"}
                href={`/app/analytics?days=${period}`}
                key={period}
              >
                {period === 1 ? "Today" : `${period} days`}
              </s-button>
            ))}
            <form className="date-filter" method="get">
              <input
                type="date"
                name="from"
                defaultValue={from}
                aria-label="From date"
              />
              <input
                type="date"
                name="to"
                defaultValue={to}
                aria-label="To date"
              />
              <s-button variant="secondary" type="submit">
                Custom
              </s-button>
            </form>
          </div>
        </header>
        <section
          className="mb-5 grid grid-cols-4 gap-[18px] max-md:grid-cols-2"
          aria-label="Wishlist analytics"
        >
          <Metric label="Wishlist adds" value={metrics.adds} />
          <Metric label="Removals" value={metrics.removes} />
          <Metric label="Move to cart" value={metrics.movesToCart} />
          <Metric
            label="Wishlist conversion"
            value={`${metrics.conversion}%`}
          />
          <Metric
            label="Active shoppers"
            value={metrics.activeSessions + metrics.activeCustomers}
          />
        </section>
        <p className="muted analytics-note">
          Conversion is successful wishlist add-to-cart events divided by
          wishlist additions in the selected period.
        </p>
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <s-card class="top-products-card rounded-xl border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <div className="card-heading">
              <div>
                <h2>Top wishlisted products</h2>
                <p className="muted">Ranked by wishlist additions.</p>
              </div>
            </div>
            {topProducts.length ? (
              topProducts.map((product) => (
                <div className="product-row" key={product.id}>
                  <div className="product-info">
                    <strong>{product.id}</strong>
                    <span>{product.adds} additions</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No wishlist additions in this period.
              </p>
            )}
          </s-card>
          <s-card class="activity-card rounded-xl block border border-wishlist-line bg-white px-6 py-6 shadow-sm">
            <div className="card-heading">
              <div>
                <h2>Recent events</h2>
                <p className="muted">The latest tracked shopper actions.</p>
              </div>
            </div>
            {events.length ? (
              events.map((event) => (
                <div className="activity-row" key={event.id}>
                  <div className="activity-text">
                    <strong>{event.eventType.replaceAll("_", " ")}</strong>
                    <span>{event.productId || "Wishlist"}</span>
                  </div>
                  <time>{new Date(event.createdAt).toLocaleString()}</time>
                </div>
              ))
            ) : (
              <p className="empty-state">No events recorded yet.</p>
            )}
          </s-card>
        </div>
      </div>
    </s-page>
  );
}

function Metric({ label, value }) {
  return (
    <s-card class="metric rounded-xl border border-wishlist-line bg-white p-3 shadow-sm">
      <span className="metric-label">{label}</span>
      <strong>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
      <span className="metric-change">Live activity</span>
    </s-card>
  );
}
export const headers = (headersArgs) => boundary.headers(headersArgs);
