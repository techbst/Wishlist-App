import script from "../../extensions/wishlist-theme/assets/wishlist.js?raw";
import styles from "../../extensions/wishlist-theme/assets/wishlist.css?raw";

// Public static assets: the app proxy and theme page share one wishlist client.
export function loader({ params }) {
  const asset = {
    script: [script, "text/javascript; charset=utf-8"],
    styles: [styles, "text/css; charset=utf-8"],
  }[params.asset];
  if (!Array.isArray(asset)) return new Response("Not found", { status: 404 });
  return new Response(asset[0], {
    headers: { "Content-Type": asset[1], "Cache-Control": "public, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" },
  });
}
