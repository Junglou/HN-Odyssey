import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';

// ĐỊNH NGHĨA INTERFACE
interface IVariant {
  _id: Types.ObjectId;
  price: number;
  sale_price: number;
  stock: number;
  attributes: Record<string, unknown>[];
}

interface IPopulatedProduct {
  _id: Types.ObjectId;
  name: string;
  images: string[];
  price: number;
  sale_price: number;
  stock: number;
  status: string;
  variants?: IVariant[];
}

interface IPopulatedWishlistItem {
  product: IPopulatedProduct | null;
  variant_id: Types.ObjectId | null;
}

interface IPopulatedCustomer {
  _id: Types.ObjectId;
  wishlist?: IPopulatedWishlistItem[];
}

interface IRawWishlistItem {
  product?: Types.ObjectId;
  variant_id?: Types.ObjectId | null;
}

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async getWishlist(userId: string) {
    // Ép kiểu (Type Casting) bằng cấu trúc Interface đã định nghĩa
    const customer = (await this.userModel
      .findById(userId)
      .select('wishlist')
      .populate({
        path: 'wishlist.product',
        select: 'name images price sale_price stock status variants',
        model: 'Product',
      })
      .lean()
      .exec()) as unknown as IPopulatedCustomer;

    if (!customer) throw new NotFoundException('Không tìm thấy người dùng');

    const rawWishlist = customer.wishlist || [];

    // Lặp qua dữ liệu đã định kiểu rõ ràng, không dùng any
    const formattedData = rawWishlist
      .map((item: IPopulatedWishlistItem) => {
        const prod = item.product;
        if (!prod) return null; // Bỏ qua nếu sản phẩm gốc bị xóa

        // Khai báo kiểu cụ thể thay vì null, giải quyết lỗi type 'never'
        let variantInfo: IVariant | null = null;

        if (item.variant_id && prod.variants && prod.variants.length > 0) {
          variantInfo =
            prod.variants.find(
              (v) => v._id.toString() === item.variant_id?.toString(),
            ) || null;
        }

        return {
          productId: prod._id,
          variantId: item.variant_id || null,
          name: prod.name,
          images: prod.images,
          price: variantInfo ? variantInfo.price : prod.price,
          sale_price: variantInfo ? variantInfo.sale_price : prod.sale_price,
          stock: variantInfo ? variantInfo.stock : prod.stock,
          attributes: variantInfo ? variantInfo.attributes : [],
          status: prod.status,
        };
      })
      .filter((item) => item !== null);

    return {
      success: true,
      data: formattedData,
    };
  }

  async toggleWishlist(userId: string, productId: string, variantId?: string) {
    if (!isValidObjectId(productId)) {
      throw new BadRequestException('Mã sản phẩm không hợp lệ');
    }

    const objectIdProduct = new Types.ObjectId(productId);
    const objectIdVariant =
      variantId && isValidObjectId(variantId)
        ? new Types.ObjectId(variantId)
        : null;

    if (objectIdVariant) {
      const productWithVariant = await this.productModel
        .findOne({
          _id: objectIdProduct,
          'variants._id': objectIdVariant,
        })
        .lean()
        .exec();

      if (!productWithVariant) {
        throw new NotFoundException('Biến thể sản phẩm này không tồn tại');
      }
    } else {
      const productExists = await this.productModel.exists({
        _id: objectIdProduct,
      });
      if (!productExists) {
        throw new NotFoundException('Sản phẩm không tồn tại trong hệ thống');
      }
    }

    const user = await this.userModel
      .findById(userId)
      .select('wishlist')
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    // Ép kiểu mảng gốc thay vì any[]
    const wishlist = (user.get('wishlist') as IRawWishlistItem[]) || [];

    const isExist = wishlist.some((item) => {
      const matchProduct = item.product?.toString() === productId;
      const matchVariant =
        item.variant_id?.toString() === (variantId || undefined) ||
        (item.variant_id === null && !variantId);
      return matchProduct && matchVariant;
    });

    const updatePayload = {
      product: objectIdProduct,
      variant_id: objectIdVariant,
    };

    if (isExist) {
      await this.userModel.updateOne(
        { _id: userId },
        { $pull: { wishlist: updatePayload } },
        { strict: false },
      );

      return {
        success: true,
        message: 'Đã xóa khỏi danh sách yêu thích',
        isAdded: false,
      };
    } else {
      await this.userModel.updateOne(
        { _id: userId },
        { $push: { wishlist: updatePayload } },
        { strict: false },
      );

      return {
        success: true,
        message: 'Đã thêm vào danh sách yêu thích',
        isAdded: true,
      };
    }
  }
}
