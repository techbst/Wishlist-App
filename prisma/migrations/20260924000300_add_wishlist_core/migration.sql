CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL UNIQUE,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CustomerWishlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerWishlist_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wishlistId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productHandle" TEXT,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "productUrl" TEXT,
    "productImage" TEXT,
    "price" TEXT,
    "compareAtPrice" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "CustomerWishlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WishlistShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wishlistId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WishlistShare_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "CustomerWishlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerWishlist_shopId_customerId_key" ON "CustomerWishlist"("shopId", "customerId");
CREATE INDEX "CustomerWishlist_shopId_updatedAt_idx" ON "CustomerWishlist"("shopId", "updatedAt");
CREATE UNIQUE INDEX "WishlistItem_wishlistId_variantKey_key" ON "WishlistItem"("wishlistId", "variantKey");
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");
CREATE INDEX "WishlistItem_wishlistId_addedAt_idx" ON "WishlistItem"("wishlistId", "addedAt");
CREATE INDEX "WishlistShare_wishlistId_createdAt_idx" ON "WishlistShare"("wishlistId", "createdAt");
CREATE INDEX "AnalyticsEvent_shopId_eventType_createdAt_idx" ON "AnalyticsEvent"("shopId", "eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_shopId_productId_createdAt_idx" ON "AnalyticsEvent"("shopId", "productId", "createdAt");
CREATE INDEX "AnalyticsEvent_shopId_customerId_idx" ON "AnalyticsEvent"("shopId", "customerId");
