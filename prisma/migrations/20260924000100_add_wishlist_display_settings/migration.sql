ALTER TABLE "WishlistSettings" ADD COLUMN "showOnProductCards" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WishlistSettings" ADD COLUMN "iconStyle" TEXT NOT NULL DEFAULT 'heart';
ALTER TABLE "WishlistSettings" ADD COLUMN "cardStyle" TEXT NOT NULL DEFAULT 'floating';
