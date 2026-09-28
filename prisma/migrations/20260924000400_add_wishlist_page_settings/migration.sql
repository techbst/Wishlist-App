ALTER TABLE "WishlistSettings" ADD COLUMN "pageHeading" TEXT NOT NULL DEFAULT 'My wishlist';
ALTER TABLE "WishlistSettings" ADD COLUMN "emptyMessage" TEXT NOT NULL DEFAULT 'Your wishlist is empty.';
ALTER TABLE "WishlistSettings" ADD COLUMN "keepInWishlistAfterCart" BOOLEAN NOT NULL DEFAULT true;
