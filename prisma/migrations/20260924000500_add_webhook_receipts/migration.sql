-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "WebhookReceipt_shop_receivedAt_idx" ON "WebhookReceipt"("shop", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookReceipt_shop_topic_idx" ON "WebhookReceipt"("shop", "topic");
