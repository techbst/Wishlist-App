CREATE TABLE "WishlistSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "buttonLabel" TEXT NOT NULL DEFAULT 'Save to wishlist',
    "accentColor" TEXT NOT NULL DEFAULT '#398b69',
    "showOnProductPages" BOOLEAN NOT NULL DEFAULT true,
    "showOnCollectionPages" BOOLEAN NOT NULL DEFAULT true,
    "guestWishlists" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "WishlistEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "productHandle" TEXT,
    "sessionKey" TEXT,
    "customerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WishlistEvent_shop_createdAt_idx" ON "WishlistEvent"("shop", "createdAt");
CREATE INDEX "WishlistEvent_shop_productId_idx" ON "WishlistEvent"("shop", "productId");
