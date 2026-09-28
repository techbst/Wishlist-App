/* eslint-disable react/prop-types */
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  const wishlists = shop
    ? await db.customerWishlist.findMany({
        where: { shopId: shop.id },
        include: { items: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      })
    : [];
  const products = new Map();
  wishlists
    .flatMap((wishlist) => wishlist.items)
    .forEach((item) => {
      const key = item.productId;
      const current = products.get(key) || {
        id: key,
        title: item.productTitle || key,
        adds: 0,
      };
      current.adds += 1;
      products.set(key, current);
    });
  return {
    customers: wishlists.length,
    items: wishlists.reduce(
      (total, wishlist) => total + wishlist.items.length,
      0,
    ),
    products: [...products.values()]
      .sort((a, b) => b.adds - a.adds)
      .slice(0, 20),
  };
};

export default function WishlistPage() {
  const { customers, items, products } = useLoaderData();
  return (
    <s-page heading="Wishlist">
      <div className="mx-auto max-w-[1240px] px-7 py-7 pb-14 font-sans text-wishlist-ink max-md:px-4 max-md:py-6">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">WISHLIST ITEMS</p>
            <h1>Saved products across customers</h1>
            <p className="muted">
              Server-side wishlist records for signed-in shoppers.
            </p>
          </div>
        </header>
        <section className="mb-5 grid grid-cols-4 gap-[18px] max-md:grid-cols-2">
          <Metric label="Customer wishlists" value={customers} />
          <Metric label="Saved items" value={items} />
        </section>
        <s-card class="top-products-card rounded-xl block border border-wishlist-line bg-white px-6 py-6 shadow-sm">
          <div className="card-heading">
            <div>
              <h2>Most saved products</h2>
              <p className="muted">Aggregate counts only.</p>
            </div>
          </div>
          {products.length ? (
            products.map((product) => (
              <div className="product-row" key={product.id}>
                <div className="product-info">
                  <strong>{product.title}</strong>
                  <span>{product.adds} saved variants</span>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No signed-in customer wishlists yet.</p>
          )}
        </s-card>
      </div>
    </s-page>
  );
}

function Metric({ label, value }) {
  return (
    <s-card class="metric rounded-xl border border-wishlist-line bg-white p-3 shadow-sm">
      <span className="metric-label">{label}</span>
      <strong>{Number(value).toLocaleString()}</strong>
    </s-card>
  );
}
export const headers = (headersArgs) => boundary.headers(headersArgs);
