import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductDocument } from '../catalog/schemas/product.schema';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

// 1. Cập nhật Interface khớp với ProductSchema
interface IPopulatedCategory {
  _id: Types.ObjectId | string;
  name: string;
}

interface IProductComparison {
  _id: Types.ObjectId | string;
  name: string;
  thumbnail?: string;
  price: number;
  sale_price?: number;
  categories: IPopulatedCategory[];
  variants?: Array<{ price: number }>;
  specs?: Array<{ name: string; values: string[] }>;
}

@Injectable()
export class ComparisonService {
  constructor(
    @InjectModel('Product') private productModel: Model<ProductDocument>,
  ) {}

  async buildComparisonMatrix(productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds)];

    const products = (await this.productModel
      .find({
        _id: { $in: uniqueProductIds.map((id) => new Types.ObjectId(id)) },
        is_deleted: false, // Dùng is_deleted thay cho is_active
      })
      .populate('categories') // Sửa từ 'category_id' thành 'categories'
      .lean()) as unknown as IProductComparison[];

    if (products.length === 0)
      throw new NotFoundException('Không tìm thấy sản phẩm');

    // AC2: RÀNG BUỘC DANH MỤC (Lấy category đầu tiên làm chuẩn)
    if (!products[0].categories || products[0].categories.length === 0) {
      throw new BadRequestException('Sản phẩm chưa được gán danh mục.');
    }

    const firstCategory = products[0].categories[0]._id.toString();
    const isSameCategory = products.every((p) =>
      p.categories?.some((c) => c._id.toString() === firstCategory),
    );

    if (!isSameCategory) {
      throw new BadRequestException(
        'Chỉ có thể so sánh các sản phẩm cùng loại danh mục.',
      );
    }

    // AC5 & AC10: ĐỒNG BỘ THUỘC TÍNH TỪ `specs`
    const allAttributeKeys = new Set<string>();

    products.forEach((p) => {
      if (p.specs && p.specs.length > 0) {
        p.specs.forEach((spec) => allAttributeKeys.add(spec.name));
      }
    });

    const matrix = products.map((p) => {
      // Tìm giá biến thể thấp nhất
      let minPrice = p.price;
      if (p.variants && p.variants.length > 0) {
        minPrice = Math.min(...p.variants.map((v) => v.price));
      }

      // Map thông số kỹ thuật (Từ specs sang dạng Key-Value)
      const mappedAttributes: Record<string, unknown> = {};
      allAttributeKeys.forEach((key) => {
        const spec = p.specs?.find((s) => s.name === key);
        mappedAttributes[key] =
          spec && spec.values.length > 0 ? spec.values.join(', ') : 'N/A';
      });

      // Tính % giảm giá nếu có sale_price
      let discountRate = 0;
      if (p.sale_price && p.sale_price > 0 && p.sale_price < p.price) {
        discountRate = Math.floor(((p.price - p.sale_price) / p.price) * 100);
      }

      return {
        _id: p._id,
        name: p.name,
        thumbnail: p.thumbnail,
        price_display:
          minPrice < p.price
            ? `Từ ${minPrice.toLocaleString()}đ`
            : `${p.price.toLocaleString()}đ`,
        discount_rate: discountRate,
        attributes: mappedAttributes,
      };
    });

    return new BaseResponse(true, 'Dữ liệu so sánh', {
      category: products[0].categories[0].name,
      attributes_list: Array.from(allAttributeKeys),
      products: matrix,
    });
  }

  // AC11: Gợi ý thêm sản phẩm vào bảng
  async getSimilarProducts(productId: string) {
    const product = (await this.productModel
      .findById(productId)
      .lean()) as unknown as IProductComparison;

    if (!product || !product.categories || product.categories.length === 0) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc lỗi danh mục');
    }

    const minPrice = product.price * 0.8;
    const maxPrice = product.price * 1.2;

    const suggestions = await this.productModel
      .find({
        categories: product.categories[0]._id, // Sửa thành query vào mảng categories
        _id: { $ne: product._id },
        price: { $gte: minPrice, $lte: maxPrice },
        is_deleted: false, // Thay is_active
      })
      .limit(4)
      .select('name thumbnail price sale_price')
      .lean();

    return new BaseResponse(true, 'Gợi ý sản phẩm', suggestions);
  }
}
