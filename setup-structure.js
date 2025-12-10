const fs = require('fs');
const path = require('path');

// DANH SÁCH FILE CẤU TRÚC CHUẨN MONGODB (MONGOOSE)
const filesToCreate = [
  // --- CONFIG ---
  'src/config/app.config.ts',
  'src/config/database.config.ts', // Cấu hình MongooseModule.forRoot()
  'src/config/mail.config.ts',
  'src/config/redis.config.ts',
  'src/config/storage.config.ts',

  // --- COMMON ---
  'src/common/constants/error-codes.constant.ts',
  'src/common/constants/messages.constant.ts',
  'src/common/decorators/current-user.decorator.ts',
  'src/common/decorators/public.decorator.ts',
  'src/common/decorators/roles.decorator.ts',
  'src/common/dtos/pagination-query.dto.ts',
  'src/common/dtos/base-response.dto.ts',
  'src/common/enums/role.enum.ts',
  'src/common/enums/sort-order.enum.ts',
  'src/common/filters/http-exception.filter.ts',
  'src/common/guards/jwt-auth.guard.ts',
  'src/common/guards/roles.guard.ts',
  'src/common/interceptors/logging.interceptor.ts',
  'src/common/interceptors/transform.interceptor.ts',
  'src/common/interfaces/request-with-user.interface.ts',
  'src/common/pipes/validation.pipe.ts',
  'src/common/utils/file-upload.util.ts',
  'src/common/utils/hash.util.ts',

  // --- MODULE: AUTH ---
  'src/modules/auth/dto/login.dto.ts',
  'src/modules/auth/dto/register.dto.ts',
  'src/modules/auth/dto/refresh-token.dto.ts',
  'src/modules/auth/dto/forgot-password.dto.ts',
  'src/modules/auth/dto/reset-password.dto.ts',
  'src/modules/auth/strategies/jwt.strategy.ts',
  'src/modules/auth/strategies/local.strategy.ts',
  'src/modules/auth/strategies/google.strategy.ts',
  'src/modules/auth/strategies/facebook.strategy.ts',
  'src/modules/auth/auth.controller.ts',
  'src/modules/auth/auth.module.ts',
  'src/modules/auth/auth.service.ts',

  // --- MODULE: USERS ---
  'src/modules/users/admin/dto/create-staff.dto.ts',
  'src/modules/users/admin/dto/update-permissions.dto.ts',
  'src/modules/users/admin/admin.controller.ts',
  'src/modules/users/admin/admin.module.ts',
  'src/modules/users/admin/admin.service.ts',

  'src/modules/users/customers/dto/update-profile.dto.ts',
  'src/modules/users/customers/dto/change-password.dto.ts',
  'src/modules/users/customers/schemas/customer.schema.ts', // Changed to schema
  'src/modules/users/customers/customers.controller.ts',
  'src/modules/users/customers/customers.module.ts',
  'src/modules/users/customers/customers.service.ts',

  'src/modules/users/addresses/dto/create-address.dto.ts',
  'src/modules/users/addresses/dto/update-address.dto.ts',
  'src/modules/users/addresses/schemas/address.schema.ts', // Changed to schema
  'src/modules/users/addresses/addresses.controller.ts',
  'src/modules/users/addresses/addresses.module.ts',
  'src/modules/users/addresses/addresses.service.ts',

  'src/modules/users/wishlist/dto/add-wishlist-item.dto.ts',
  'src/modules/users/wishlist/schemas/wishlist-item.schema.ts', // Changed to schema
  'src/modules/users/wishlist/wishlist.controller.ts',
  'src/modules/users/wishlist/wishlist.module.ts',
  'src/modules/users/wishlist/wishlist.service.ts',

  'src/modules/users/schemas/user.schema.ts', // Changed to schema
  'src/modules/users/users.module.ts',

  // --- MODULE: PRODUCTS ---
  'src/modules/products/catalog/dto/create-product.dto.ts',
  'src/modules/products/catalog/dto/update-product.dto.ts',
  'src/modules/products/catalog/dto/filter-product.dto.ts',
  'src/modules/products/catalog/schemas/product.schema.ts', // Main Document
  'src/modules/products/catalog/schemas/product-variant.schema.ts', // Sub-document
  'src/modules/products/catalog/schemas/product-image.schema.ts', // Sub-document
  'src/modules/products/catalog/products.controller.ts',
  'src/modules/products/catalog/products.module.ts',
  'src/modules/products/catalog/products.service.ts',

  'src/modules/products/categories/dto/create-category.dto.ts',
  'src/modules/products/categories/dto/update-category-order.dto.ts',
  'src/modules/products/categories/schemas/category.schema.ts', // Tree structure in Mongo
  'src/modules/products/categories/categories.controller.ts',
  'src/modules/products/categories/categories.module.ts',
  'src/modules/products/categories/categories.service.ts',

  'src/modules/products/attributes/dto/create-attribute.dto.ts',
  'src/modules/products/attributes/schemas/attribute.schema.ts',
  'src/modules/products/attributes/schemas/attribute-value.schema.ts',
  'src/modules/products/attributes/attributes.controller.ts',
  'src/modules/products/attributes/attributes.module.ts',
  'src/modules/products/attributes/attributes.service.ts',

  'src/modules/products/tags/dto/create-tag.dto.ts',
  'src/modules/products/tags/schemas/tag.schema.ts',
  'src/modules/products/tags/tags.controller.ts',
  'src/modules/products/tags/tags.module.ts',
  'src/modules/products/tags/tags.service.ts',

  'src/modules/products/reviews/dto/create-review.dto.ts',
  'src/modules/products/reviews/dto/reply-review.dto.ts',
  'src/modules/products/reviews/schemas/review.schema.ts',
  'src/modules/products/reviews/reviews.controller.ts',
  'src/modules/products/reviews/reviews.module.ts',
  'src/modules/products/reviews/reviews.service.ts',

  'src/modules/products/comparison/dto/add-comparison.dto.ts',
  'src/modules/products/comparison/comparison.controller.ts',
  'src/modules/products/comparison/comparison.module.ts',
  'src/modules/products/comparison/comparison.service.ts',

  'src/modules/products/products.module.ts',

  // --- MODULE: SEARCH ---
  'src/modules/search/dto/search-query.dto.ts',
  'src/modules/search/interfaces/search-result.interface.ts',
  'src/modules/search/elasticsearch/elasticsearch.service.ts', // Vẫn cần nếu dùng Full-text search nâng cao
  'src/modules/search/search.controller.ts',
  'src/modules/search/search.module.ts',
  'src/modules/search/search.service.ts',

  // --- MODULE: SALES ---
  'src/modules/sales/cart/dto/add-to-cart.dto.ts',
  'src/modules/sales/cart/dto/update-cart-item.dto.ts',
  'src/modules/sales/cart/schemas/cart.schema.ts', // Redis hoặc Mongo
  'src/modules/sales/cart/schemas/cart-item.schema.ts',
  'src/modules/sales/cart/cart.controller.ts',
  'src/modules/sales/cart/cart.module.ts',
  'src/modules/sales/cart/cart.service.ts',

  'src/modules/sales/orders/dto/create-order.dto.ts',
  'src/modules/sales/orders/dto/guest-checkout.dto.ts',
  'src/modules/sales/orders/dto/update-order-status.dto.ts',
  'src/modules/sales/orders/schemas/order.schema.ts', // Embed order items here usually
  'src/modules/sales/orders/schemas/order-item.schema.ts',
  'src/modules/sales/orders/schemas/order-history.schema.ts', // US.122 Timeline
  'src/modules/sales/orders/flow/order-state-machine.service.ts',
  'src/modules/sales/orders/orders.controller.ts',
  'src/modules/sales/orders/orders.module.ts',
  'src/modules/sales/orders/orders.service.ts',

  'src/modules/sales/payment/dto/create-payment-link.dto.ts',
  'src/modules/sales/payment/schemas/payment-transaction.schema.ts',
  'src/modules/sales/payment/schemas/payment-config.schema.ts', // US.57 Config
  'src/modules/sales/payment/providers/vnpay.service.ts',
  'src/modules/sales/payment/providers/momo.service.ts',
  'src/modules/sales/payment/providers/cod.service.ts',
  'src/modules/sales/payment/payment.controller.ts',
  'src/modules/sales/payment/payment.module.ts',
  'src/modules/sales/payment/payment.service.ts',

  'src/modules/sales/sales.module.ts',

  // --- MODULE: INVENTORY ---
  'src/modules/inventory/stock/dto/adjust-stock.dto.ts',
  'src/modules/inventory/stock/schemas/stock-level.schema.ts',
  'src/modules/inventory/stock/stock.controller.ts',
  'src/modules/inventory/stock/stock.module.ts',
  'src/modules/inventory/stock/stock.service.ts',

  'src/modules/inventory/transactions/dto/create-import-note.dto.ts',
  'src/modules/inventory/transactions/dto/create-export-note.dto.ts',
  'src/modules/inventory/transactions/schemas/stock-transaction.schema.ts', // Header
  'src/modules/inventory/transactions/schemas/stock-transaction-item.schema.ts', // Detail
  'src/modules/inventory/transactions/transactions.controller.ts',
  'src/modules/inventory/transactions/transactions.module.ts',
  'src/modules/inventory/transactions/transactions.service.ts',

  'src/modules/inventory/alerts/stock-alert.service.ts',
  'src/modules/inventory/alerts/stock-alert.module.ts',
  'src/modules/inventory/inventory.module.ts',

  // --- MODULE: TRADE-IN ---
  'src/modules/trade-in/dto/create-trade-in-request.dto.ts',
  'src/modules/trade-in/dto/value-estimation.dto.ts',
  'src/modules/trade-in/schemas/trade-in-request.schema.ts',
  'src/modules/trade-in/trade-in.controller.ts',
  'src/modules/trade-in/trade-in.module.ts',
  'src/modules/trade-in/trade-in.service.ts',

  // --- MODULE: MARKETING ---
  'src/modules/marketing/loyalty/dto/redeem-reward.dto.ts',
  'src/modules/marketing/loyalty/schemas/loyalty-point.schema.ts',
  'src/modules/marketing/loyalty/schemas/member-tier.schema.ts',
  'src/modules/marketing/loyalty/schemas/reward.schema.ts',
  'src/modules/marketing/loyalty/loyalty.controller.ts',
  'src/modules/marketing/loyalty/loyalty.module.ts',
  'src/modules/marketing/loyalty/loyalty.service.ts',

  'src/modules/marketing/promotions/dto/create-coupon.dto.ts',
  'src/modules/marketing/promotions/dto/create-flash-sale.dto.ts',
  'src/modules/marketing/promotions/schemas/coupon.schema.ts',
  'src/modules/marketing/promotions/schemas/flash-sale.schema.ts',
  'src/modules/marketing/promotions/promotions.controller.ts',
  'src/modules/marketing/promotions/promotions.module.ts',
  'src/modules/marketing/promotions/promotions.service.ts',

  'src/modules/marketing/campaigns/dto/create-campaign.dto.ts',
  'src/modules/marketing/campaigns/schemas/ad-campaign.schema.ts',
  'src/modules/marketing/campaigns/schemas/campaign-tracking.schema.ts', // US.84 UTM tracking
  'src/modules/marketing/campaigns/campaigns.controller.ts',
  'src/modules/marketing/campaigns/campaigns.module.ts',
  'src/modules/marketing/campaigns/campaigns.service.ts',

  'src/modules/marketing/content/dto/create-post.dto.ts',
  'src/modules/marketing/content/dto/create-banner.dto.ts',
  'src/modules/marketing/content/dto/create-static-page.dto.ts',
  'src/modules/marketing/content/schemas/blog-post.schema.ts',
  'src/modules/marketing/content/schemas/banner.schema.ts',
  'src/modules/marketing/content/schemas/static-page.schema.ts', // US.126
  'src/modules/marketing/content/schemas/menu-config.schema.ts',
  'src/modules/marketing/content/content.controller.ts',
  'src/modules/marketing/content/content.module.ts',
  'src/modules/marketing/content/content.service.ts',

  'src/modules/marketing/marketing.module.ts',

  // --- MODULE: RECOMMENDATIONS ---
  'src/modules/recommendations/tracking/dto/track-event.dto.ts',
  'src/modules/recommendations/tracking/schemas/user-behavior.schema.ts', // Mongo is perfect for this
  'src/modules/recommendations/tracking/tracking.controller.ts',
  'src/modules/recommendations/tracking/tracking.module.ts',
  'src/modules/recommendations/tracking/tracking.service.ts',

  'src/modules/recommendations/engine/collaborative-filtering.service.ts',
  'src/modules/recommendations/engine/content-based.service.ts',
  'src/modules/recommendations/engine/engine.module.ts',
  'src/modules/recommendations/engine/engine.service.ts',

  'src/modules/recommendations/recommendations.controller.ts',
  'src/modules/recommendations/recommendations.module.ts',
  'src/modules/recommendations/recommendations.service.ts',

  // --- MODULE: SHIPPING ---
  'src/modules/shipping/dto/calculate-fee.dto.ts',
  'src/modules/shipping/dto/create-shipping-order.dto.ts',
  'src/modules/shipping/providers/ghn.service.ts',
  'src/modules/shipping/providers/ghtk.service.ts',
  'src/modules/shipping/shipping.controller.ts',
  'src/modules/shipping/shipping.module.ts',
  'src/modules/shipping/shipping.service.ts',

  // --- MODULE: SUPPORT ---
  'src/modules/support/chat/dto/send-message.dto.ts',
  'src/modules/support/chat/schemas/conversation.schema.ts',
  'src/modules/support/chat/schemas/message.schema.ts',
  'src/modules/support/chat/chat.gateway.ts',
  'src/modules/support/chat/chat.module.ts',
  'src/modules/support/chat/chat.service.ts',

  'src/modules/support/warranty/dto/create-warranty-claim.dto.ts',
  'src/modules/support/warranty/schemas/warranty-claim.schema.ts',
  'src/modules/support/warranty/warranty.controller.ts',
  'src/modules/support/warranty/warranty.module.ts',
  'src/modules/support/warranty/warranty.service.ts',
  'src/modules/support/support.module.ts',

  // --- MODULE: REPORTS ---
  'src/modules/reports/dashboard/dto/date-range.dto.ts',
  'src/modules/reports/dashboard/dashboard.controller.ts',
  'src/modules/reports/dashboard/dashboard.module.ts',
  'src/modules/reports/dashboard/dashboard.service.ts',

  'src/modules/reports/business/business-reports.controller.ts',
  'src/modules/reports/business/business-reports.module.ts',
  'src/modules/reports/business/business-reports.service.ts',

  'src/modules/reports/export/schemas/export-history.schema.ts', // US.99
  'src/modules/reports/export/export.controller.ts',
  'src/modules/reports/export/export.module.ts',
  'src/modules/reports/export/export.processor.ts',
  'src/modules/reports/export/export.service.ts',

  'src/modules/reports/reports.module.ts',

  // --- MODULE: NOTIFICATIONS ---
  'src/modules/notifications/dto/send-notification.dto.ts',
  'src/modules/notifications/channels/email.service.ts',
  'src/modules/notifications/channels/sms.service.ts',
  'src/modules/notifications/channels/push.service.ts',
  'src/modules/notifications/schemas/notification-log.schema.ts',
  'src/modules/notifications/notifications.controller.ts',
  'src/modules/notifications/notifications.gateway.ts',
  'src/modules/notifications/notifications.module.ts',
  'src/modules/notifications/notifications.service.ts',

  // --- MODULE: SYSTEM ---
  'src/modules/system/audit-logs/dto/query-audit-log.dto.ts',
  'src/modules/system/audit-logs/schemas/audit-log.schema.ts', // US.55
  'src/modules/system/audit-logs/audit-logs.controller.ts',
  'src/modules/system/audit-logs/audit-logs.module.ts',
  'src/modules/system/audit-logs/audit-logs.service.ts',

  'src/modules/system/health/health.controller.ts',
  'src/modules/system/health/health.module.ts',
  'src/modules/system/system.module.ts',
];

// Hàm tạo thư mục và file
filesToCreate.forEach((filePath) => {
  const absolutePath = path.join(__dirname, filePath);
  const dirName = path.dirname(absolutePath);

  // Tạo thư mục nếu chưa tồn tại
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  // Tạo file nếu chưa tồn tại
  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, '// Mongo Schema / Service / Controller\n');
    console.log(`Created: ${filePath}`);
  }
});

console.log('--- HOÀN TẤT CẤU TRÚC MONGODB CHO 126 US ---');
