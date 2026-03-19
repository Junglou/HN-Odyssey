import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose'; // FIX: Bổ sung import Types
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';

export interface StockAlertItem {
  product_id: string;
  sku: string;
  name: string;
  thumbnail: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK';
  priority: number; // Dùng để sort: 1 (Hết hàng), 2 (Sắp hết), 3 (Dư thừa)
}

interface RawAggregatedProduct {
  _id: Types.ObjectId | string;
  sku: string;
  name: string;
  thumbnail?: string;
  stock: number;
  min_stock: number;
  max_stock: number;
  has_variants: boolean;
  variants: Array<{
    sku: string;
    stock: number;
    min_stock?: number;
    max_stock?: number;
  }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  // [US3 - AC3] Lấy danh sách cảnh báo tồn kho cho Dashboard Widget
  async getStockAlertsWidget(): Promise<StockAlertItem[]> {
    const products = await this.productModel.aggregate<RawAggregatedProduct>([
      { $match: { is_deleted: false, status: 'ACTIVE' } },
      {
        $match: {
          $expr: {
            $or: [
              // TH1: Sản phẩm không có biến thể, kiểm tra stock tổng
              {
                $and: [
                  { $eq: ['$has_variants', false] },
                  {
                    $or: [
                      { $lte: ['$stock', '$min_stock'] }, // Nhỏ hơn hoặc bằng Min
                      { $gt: ['$stock', '$max_stock'] }, // Lớn hơn Max
                    ],
                  },
                ],
              },
              // TH2: Sản phẩm có biến thể, kiểm tra bên trong mảng variants
              {
                $and: [
                  { $eq: ['$has_variants', true] },
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: '$variants',
                            as: 'v',
                            cond: {
                              $or: [
                                {
                                  $lte: [
                                    '$$v.stock',
                                    {
                                      $ifNull: ['$$v.min_stock', '$min_stock'],
                                    },
                                  ],
                                },
                                {
                                  $gt: [
                                    '$$v.stock',
                                    {
                                      $ifNull: ['$$v.max_stock', '$max_stock'],
                                    },
                                  ],
                                },
                              ],
                            },
                          },
                        },
                      },
                      0, // Lọc ra các sản phẩm có ít nhất 1 biến thể vi phạm
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    ]);

    const alerts: StockAlertItem[] = [];

    // Bóc tách dữ liệu trả về thành list phẳng (flat list) cho Frontend dễ render
    for (const product of products) {
      if (!product.has_variants) {
        let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK' = 'LOW_STOCK';
        let priority = 2;

        if (product.stock <= 0) {
          status = 'OUT_OF_STOCK';
          priority = 1;
        } else if (product.stock > product.max_stock) {
          status = 'OVER_STOCK';
          priority = 3;
        }

        alerts.push({
          product_id: product._id.toString(),
          sku: product.sku,
          name: product.name,
          thumbnail: product.thumbnail || '',
          current_stock: product.stock,
          min_stock: product.min_stock,
          max_stock: product.max_stock,
          status,
          priority,
        });
      } else {
        // Nếu có biến thể, bóc tách từng biến thể vi phạm
        for (const variant of product.variants) {
          const vMin = variant.min_stock ?? product.min_stock ?? 0;
          const vMax = variant.max_stock ?? product.max_stock ?? 999999;

          if (variant.stock <= vMin || variant.stock > vMax) {
            let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK' =
              'LOW_STOCK';
            let priority = 2;

            if (variant.stock <= 0) {
              status = 'OUT_OF_STOCK';
              priority = 1;
            } else if (variant.stock > vMax) {
              status = 'OVER_STOCK';
              priority = 3;
            }

            alerts.push({
              product_id: product._id.toString(),
              sku: variant.sku,
              name: `${product.name} - ${variant.sku}`,
              thumbnail: product.thumbnail || '',
              current_stock: variant.stock,
              min_stock: vMin,
              max_stock: vMax,
              status,
              priority,
            });
          }
        }
      }
    }

    // Sắp xếp theo mức độ ưu tiên: Hết hàng (1) -> Sắp hết (2) -> Dư thừa (3)
    alerts.sort((a, b) => a.priority - b.priority);

    // Trả về top 20 cảnh báo khẩn cấp nhất cho Dashboard
    return alerts.slice(0, 20);
  }
}
