import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ProductsService } from './products.service';

@Injectable()
export class ProductListener {
  // Khởi tạo Logger để dễ dàng debug ở console
  private readonly logger = new Logger(ProductListener.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    // Inject ProductsService để tận dụng lại hàm syncToSearchEngine (Algolia)
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Lắng nghe sự kiện từ MediaService khi có ảnh mới được "Đặt làm ảnh đại diện"
   */
  @OnEvent('product.thumbnail.updated', { async: true }) // async: true giúp event chạy ngầm không block request chính
  async handleProductThumbnailUpdated(payload: {
    productId: string;
    thumbnailUrl: string;
  }) {
    try {
      // 1. Tìm sản phẩm theo ID
      const product = await this.productModel.findById(payload.productId);

      if (!product) {
        this.logger.warn(
          `[EVENT BỎ QUA] Không tìm thấy Product ID: ${payload.productId} để cập nhật thumbnail.`,
        );
        return;
      }

      // 2. Cập nhật URL ảnh mới vào trường thumbnail
      product.thumbnail = payload.thumbnailUrl;
      await product.save();

      // 3. Nếu sản phẩm đang bán (ACTIVE), đồng bộ lại data lên Algolia ngay lập tức
      // Việc này giúp Storefront (trang chủ) cập nhật ảnh mới mà không cần F5 thủ công
      if (product.status === ProductStatus.ACTIVE) {
        this.productsService.syncToSearchEngine(product).catch((err) => {
          this.logger.error(
            `[ALGOLIA ERROR] Lỗi đồng bộ khi cập nhật thumbnail cho SKU ${product.sku}:`,
            err,
          );
        });
      }

      this.logger.log(
        `[EVENT SUCCESS] Tự động cập nhật thumbnail cho SKU: ${product.sku}`,
      );
    } catch (error) {
      this.logger.error(
        `[EVENT ERROR] Lỗi hệ thống khi xử lý thumbnail cho Product ID: ${payload.productId}`,
        error,
      );
    }
  }

  /**
   * (MỞ RỘNG) Lắng nghe sự kiện khi có file bị xóa hoặc upload mới
   * Để đồng bộ trường "images" hoặc "gallery" nếu bạn có nhu cầu sau này.
   */
  @OnEvent('product.media.changed', { async: true })
  async handleProductMediaChanged(payload: { productId: string }) {
    try {
      this.logger.log(
        `[EVENT RECEIVED] Đã phát hiện thay đổi thư viện ảnh của Product ID: ${payload.productId}`,
      );
      // Tại đây bạn có thể dùng mongoose query thẳng qua bảng Media để lấy array URLs
      // và đập lại vào trường product.images.
    } catch (error) {
      this.logger.error(`[EVENT ERROR] Lỗi đồng bộ thư viện ảnh.`, error);
    }
  }
}
