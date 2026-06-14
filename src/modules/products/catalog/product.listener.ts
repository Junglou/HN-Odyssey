import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ProductsService } from './products.service';

export interface ProductThumbnailPayload {
  productId: string;
  thumbnailUrl: string;
}

export interface VariantThumbnailPayload {
  variantSku: string;
  thumbnailUrl: string;
}

export interface BulkMediaPayload {
  targetId: string;
  type: string;
  urls: string[];
}

export interface MediaDeletedPayload {
  targetId: string;
  type: string;
  url: string;
}

@Injectable()
export class ProductListener {
  private readonly logger = new Logger(ProductListener.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly productsService: ProductsService,
  ) {}

  // 1. LẮNG NGHE ĐỔI ẢNH ĐẠI DIỆN SẢN PHẨM MẸ
  @OnEvent('product.thumbnail.updated', { async: true })
  async handleProductThumbnailUpdated(payload: ProductThumbnailPayload) {
    try {
      const product = await this.productModel.findById(payload.productId);

      if (!product) {
        this.logger.warn(
          `[EVENT BỎ QUA] Không tìm thấy Product ID: ${payload.productId}`,
        );
        return;
      }

      product.thumbnail = payload.thumbnailUrl;
      await product.save();

      if (product.status === ProductStatus.ACTIVE) {
        this.productsService
          .syncToSearchEngine(product)
          .catch((err: unknown) => {
            this.logger.error(
              `[ALGOLIA ERROR] Lỗi đồng bộ SKU ${product.sku}:`,
              err instanceof Error ? err.stack : String(err),
            );
          });
      }

      this.logger.log(
        `[EVENT SUCCESS] Đã cập nhật thumbnail cho SKU: ${product.sku}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `[EVENT ERROR] Lỗi xử lý thumbnail cho Product ID: ${payload.productId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // 2. LẮNG NGHE ĐỔI ẢNH ĐẠI DIỆN CHO BIẾN THỂ (VARIANT)
  @OnEvent('variant.thumbnail.updated', { async: true })
  async handleVariantThumbnailUpdated(payload: VariantThumbnailPayload) {
    try {
      // handle: Đẩy ảnh primary vào mảng images của Variant bằng $addToSet (chống trùng lặp)
      const result = await this.productModel.updateOne(
        { 'variants.sku': payload.variantSku },
        { $addToSet: { 'variants.$.images': payload.thumbnailUrl } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `[EVENT SUCCESS] Đã thêm ảnh vào mảng images cho Variant SKU: ${payload.variantSku}`,
        );
      } else {
        this.logger.warn(
          `[EVENT BỎ QUA] Không tìm thấy Variant SKU: ${payload.variantSku} để gắn ảnh.`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `[EVENT ERROR] Lỗi cập nhật ảnh Variant SKU: ${payload.variantSku}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // 3. LẮNG NGHE UPLOAD HÀNG LOẠT (Đẩy vào mảng Images)
  @OnEvent('media.bulk.uploaded', { async: true })
  async handleMediaBulkUploaded(payload: BulkMediaPayload) {
    try {
      const safeType = payload.type.toUpperCase();

      if (safeType === 'PRODUCT') {
        await this.productModel.findByIdAndUpdate(payload.targetId, {
          $push: { images: { $each: payload.urls } },
        });
        this.logger.log(
          `[EVENT SUCCESS] Đã thêm ${payload.urls.length} ảnh vào mảng images của Product ID: ${payload.targetId}`,
        );
      } else if (safeType === 'VARIANT' && payload.urls.length > 0) {
        // handle: Cập nhật đẩy toàn bộ URL vào mảng images của Variant
        await this.productModel.updateOne(
          { 'variants.sku': payload.targetId },
          { $push: { 'variants.$.images': { $each: payload.urls } } },
        );
        this.logger.log(
          `[EVENT SUCCESS] Đã lưu ${payload.urls.length} ảnh bulk vào mảng images của Variant SKU: ${payload.targetId}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `[EVENT ERROR] Lỗi Bulk Upload targetId: ${payload.targetId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // 4. LẮNG NGHE XÓA ẢNH (Dọn dẹp rác dữ liệu)
  @OnEvent('media.deleted', { async: true })
  async handleMediaDeleted(payload: MediaDeletedPayload) {
    try {
      const safeType = payload.type.toUpperCase();

      if (safeType === 'PRODUCT') {
        const product = await this.productModel.findById(payload.targetId);
        if (!product) return;

        let isModified = false;

        if (product.thumbnail === payload.url) {
          product.thumbnail = '';
          isModified = true;
        }

        if (product.images && product.images.length > 0) {
          const originalLength = product.images.length;
          product.images = product.images.filter((img) => img !== payload.url);
          if (product.images.length !== originalLength) {
            isModified = true;
          }
        }

        if (isModified) {
          await product.save();
          this.logger.log(
            `[EVENT SUCCESS] Đã dọn dẹp URL ảnh bị xóa cho Product ID: ${payload.targetId}`,
          );
        }
      } else if (safeType === 'VARIANT') {
        // handle: Dùng $pull để xóa chính xác URL ra khỏi mảng images của Variant
        const result = await this.productModel.updateOne(
          { 'variants.sku': payload.targetId },
          {
            $pull: { 'variants.$[elem].images': payload.url },
          },
          {
            arrayFilters: [{ 'elem.sku': payload.targetId }],
          },
        );

        if (result.modifiedCount > 0) {
          this.logger.log(
            `[EVENT SUCCESS] Đã dọn dẹp ảnh khỏi mảng images cho Variant SKU: ${payload.targetId}`,
          );
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `[EVENT ERROR] Lỗi xử lý dọn dẹp ảnh khi Media bị xóa (Target: ${payload.targetId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
