ALTER TABLE "WishlistSettings" ADD COLUMN "textColor" TEXT NOT NULL DEFAULT '#20352b';
ALTER TABLE "WishlistSettings" ADD COLUMN "iconColor" TEXT NOT NULL DEFAULT '#398b69';
ALTER TABLE "WishlistSettings" ADD COLUMN "toastMessage" TEXT NOT NULL DEFAULT 'Added to your wishlist';
ALTER TABLE "WishlistSettings" ADD COLUMN "productButtonDisplay" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "WishlistSettings" ADD COLUMN "zIndex" INTEGER NOT NULL DEFAULT 20;
