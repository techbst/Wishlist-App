-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerWishlist" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
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
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistShare" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistSettings" (
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "buttonLabel" TEXT NOT NULL DEFAULT 'Save to wishlist',
    "accentColor" TEXT NOT NULL DEFAULT '#FF5C01',
    "textColor" TEXT NOT NULL DEFAULT '#20352b',
    "iconColor" TEXT NOT NULL DEFAULT '#FF5C01',
    "toastMessage" TEXT NOT NULL DEFAULT 'Added to your wishlist',
    "productButtonDisplay" TEXT NOT NULL DEFAULT 'both',
    "zIndex" INTEGER NOT NULL DEFAULT 20,
    "showOnProductPages" BOOLEAN NOT NULL DEFAULT true,
    "showOnCollectionPages" BOOLEAN NOT NULL DEFAULT true,
    "guestWishlists" BOOLEAN NOT NULL DEFAULT true,
    "customerWishlists" BOOLEAN NOT NULL DEFAULT true,
    "showOnProductCards" BOOLEAN NOT NULL DEFAULT true,
    "iconStyle" TEXT NOT NULL DEFAULT 'heart',
    "cardStyle" TEXT NOT NULL DEFAULT 'floating',
    "productButtonPosition" TEXT NOT NULL DEFAULT 'product-info',
    "showWishlistLink" BOOLEAN NOT NULL DEFAULT false,
    "wishlistSharing" BOOLEAN NOT NULL DEFAULT true,
    "pageHeading" TEXT NOT NULL DEFAULT 'My wishlist',
    "emptyMessage" TEXT NOT NULL DEFAULT 'Your wishlist is empty.',
    "keepInWishlistAfterCart" BOOLEAN NOT NULL DEFAULT true,
    "customization" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistSettings_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "WishlistEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "productHandle" TEXT,
    "sessionKey" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "CustomerWishlist_shopId_updatedAt_idx" ON "CustomerWishlist"("shopId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerWishlist_shopId_customerId_key" ON "CustomerWishlist"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE INDEX "WishlistItem_wishlistId_addedAt_idx" ON "WishlistItem"("wishlistId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_variantKey_key" ON "WishlistItem"("wishlistId", "variantKey");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistShare_token_key" ON "WishlistShare"("token");

-- CreateIndex
CREATE INDEX "WishlistShare_wishlistId_createdAt_idx" ON "WishlistShare"("wishlistId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shopId_eventType_createdAt_idx" ON "AnalyticsEvent"("shopId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shopId_productId_createdAt_idx" ON "AnalyticsEvent"("shopId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shopId_customerId_idx" ON "AnalyticsEvent"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "WishlistEvent_shop_createdAt_idx" ON "WishlistEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistEvent_shop_productId_idx" ON "WishlistEvent"("shop", "productId");

-- CreateIndex
CREATE INDEX "WebhookReceipt_shop_receivedAt_idx" ON "WebhookReceipt"("shop", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookReceipt_shop_topic_idx" ON "WebhookReceipt"("shop", "topic");

-- AddForeignKey
ALTER TABLE "CustomerWishlist" ADD CONSTRAINT "CustomerWishlist_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "CustomerWishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistShare" ADD CONSTRAINT "WishlistShare_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "CustomerWishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
