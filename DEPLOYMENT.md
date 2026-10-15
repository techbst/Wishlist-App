# Vercel production database

Connect a Neon PostgreSQL database to the existing Vercel Wishlist project using
the Vercel Marketplace. Set `DATABASE_URL` to the database's pooled PostgreSQL
connection string in Vercel's Production environment. Keep secrets out of Git.
Preview deployments must use a separate database, not the production connection.

Keep these existing production variables configured:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL=https://wishlist-app-eight-lovat.vercel.app`
- `SCOPES=read_orders,read_products,write_app_proxy`

Deploy this source after connecting the database. `vercel.json` runs
`npm run vercel-build`, which prepares the PostgreSQL schema, applies migrations,
generates Prisma Client, and builds the application. A missing database or failed
migration stops deployment instead of publishing a broken build.

Local `npm run setup` continues to use SQLite. Production uses separate migrations
under `prisma/postgresql/migrations`; do not apply the SQLite migrations to Postgres.
The production schema is generated from `prisma/schema.prisma`, so edit models only
in that source file. For future model changes, generate and review a new PostgreSQL
migration as well as the local SQLite migration before deploying.

The initial migration creates an empty database. It does not transfer existing
local SQLite sessions, settings, or wishlists. Do not reset an existing production
database. After deploying, open Wishlist from Shopify Admin and test saving an
item, reloading it, and viewing analytics. Check Vercel logs for database errors.
