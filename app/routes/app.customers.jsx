/* eslint-disable react/prop-types */
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  const customers = shop ? await db.customerWishlist.count({ where: { shopId: shop.id } }) : 0;
  return { customers };
};

export default function CustomersPage() { const { customers } = useLoaderData(); return <s-page heading="Customers"><div className="dashboard-shell"><p className="eyebrow">CUSTOMER WISHLISTS</p><h1>Signed-in wishlist shoppers</h1><p className="muted">Customer identities are intentionally not exposed in this dashboard.</p><section className="metrics"><s-card class="metric rounded-xl border border-wishlist-line bg-white p-3 shadow-sm"><span className="metric-label">Active customer wishlists</span><strong>{customers.toLocaleString()}</strong></s-card></section></div></s-page>; }
export const headers = (headersArgs) => boundary.headers(headersArgs);
